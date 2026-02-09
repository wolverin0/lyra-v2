#!/usr/bin/env node
// Lyra v2 Router — Scoring-based prompt classifier
// Runs at UserPromptSubmit as a command hook
// Analyzes user prompt and suggests optimal workflow
//
// For UserPromptSubmit command hooks, stdout is added as context
// that Claude can see and act on. This is the correct mechanism
// for injecting routing suggestions (NOT prompt hooks, which are
// yes/no gates that block or allow prompts).

const fs = require('fs');

function main() {
  let userPrompt = '';
  try {
    const input = fs.readFileSync(0, 'utf8');
    const parsed = JSON.parse(input);
    userPrompt = (parsed.prompt || parsed.message || '').trim();
  } catch { return; }

  const lower = userPrompt.toLowerCase();

  // Fast exits — never route these
  if (!lower || lower.length < 25) return;
  if (lower.startsWith('/')) return;  // slash commands
  if (lower.startsWith('git ')) return;
  if (/^(yes|no|ok|sure|thanks|done|stop|cancel|continue|go ahead|looks good)/i.test(lower)) return;

  // Detect negation around key verbs
  const hasNegation = (word) => {
    const idx = lower.indexOf(word);
    if (idx === -1) return false;
    const before = lower.slice(Math.max(0, idx - 15), idx);
    return /\b(don'?t|do not|no|never|stop|cancel|without)\b/.test(before);
  };

  // Simple question detection
  const isQuestion = /^(what|how|why|where|when|who|can|does|is |are |do |did |should|could|would|which|explain|show|list|tell|describe|find|get|read)\b/i.test(lower);
  if (isQuestion && lower.length < 80) return;

  // --- SCORING ENGINE ---
  const scores = {
    'new-project': 0,
    'plan-phase': 0,
    'debug': 0,
    'code-review': 0,
    'security': 0,
    'build-error': 0,
    'e2e': 0,
    'refactor': 0,
  };

  // NEW PROJECT signals
  const buildVerbs = ['build', 'create', 'make', 'start', 'initialize', 'scaffold', 'bootstrap', 'set up', 'setup', 'develop'];
  const projectNouns = ['app', 'application', 'project', 'system', 'platform', 'website', 'site', 'service', 'api', 'game', 'dashboard', 'portal', 'tool', 'saas', 'mvp'];

  let hasBuildVerb = false;
  let hasProjectNoun = false;
  for (const v of buildVerbs) {
    if (lower.includes(v) && !hasNegation(v)) { hasBuildVerb = true; break; }
  }
  for (const n of projectNouns) {
    if (lower.includes(n)) { hasProjectNoun = true; break; }
  }
  if (hasBuildVerb && hasProjectNoun) scores['new-project'] += 3;
  if (/\b(from scratch|greenfield|brand new|new project|new app)\b/.test(lower)) scores['new-project'] += 2;
  if (/\b(with|including|plus|and)\b/.test(lower) && lower.length > 60) scores['new-project'] += 1;

  // Check if there's already a GSD project (suggests plan-phase instead of new-project)
  const hasGsdProject = fs.existsSync(require('path').join(process.cwd(), '.planning', 'STATE.md'));

  // COMPLEX FEATURE signals (plan-phase)
  const featureVerbs = ['implement', 'add', 'integrate', 'migrate', 'overhaul', 'redesign'];
  for (const v of featureVerbs) {
    if (lower.includes(v) && !hasNegation(v)) { scores['plan-phase'] += 1; break; }
  }
  if (/\b(frontend|backend|database|api|ui)\b/.test(lower) && /\b(and|with|plus)\b/.test(lower)) scores['plan-phase'] += 2;
  if (lower.length > 150) scores['plan-phase'] += 1;
  if (/\b(multiple|several|across|full[ -]stack)\b/.test(lower)) scores['plan-phase'] += 1;

  // DEBUG signals
  const bugWords = ['bug', 'broken', 'crash', 'error', 'fail', 'wrong', 'not working', "doesn't work", "can't", 'issue', 'problem'];
  let bugCount = 0;
  for (const w of bugWords) {
    if (lower.includes(w)) bugCount++;
  }
  if (bugCount >= 2) scores['debug'] += 3;
  if (/\b(debug|investigate|diagnose|trace|root cause)\b/.test(lower)) scores['debug'] += 3;
  if (/\b(console|log|stack trace|traceback|exception)\b/.test(lower)) scores['debug'] += 1;
  if (bugCount === 1 && lower.length > 100) scores['debug'] += 1;

  // CODE REVIEW signals
  if (/\b(code review|review (the |my |this |our )?code|review (the |my )?pr|pull request review)\b/.test(lower)) scores['code-review'] += 4;
  if (/\breview\b/.test(lower) && /\b(code|implementation|changes|module|component|quality)\b/.test(lower)) scores['code-review'] += 3;

  // SECURITY signals
  if (/\b(security|vulnerabilit|pentest|owasp|injection|xss|csrf|auth.{0,5}bypass)\b/.test(lower)) scores['security'] += 3;
  if (/\b(audit|scan|check)\b/.test(lower) && /\b(security|vulnerab|safe)\b/.test(lower)) scores['security'] += 2;

  // BUILD ERROR signals
  if (/\b(build fail|build error|compile error|type error|tsc|typescript error|won'?t build|won'?t compile|build broken)\b/.test(lower)) scores['build-error'] += 4;
  if (/\b(ts\d{4}|cannot find module|unexpected token|syntax error)\b/.test(lower)) scores['build-error'] += 3;

  // E2E TESTING signals
  if (/\b(e2e|end.to.end|playwright|cypress|selenium)\b/.test(lower)) scores['e2e'] += 4;
  if (/\b(test|testing)\b/.test(lower) && /\b(flow|journey|scenario|user path)\b/.test(lower)) scores['e2e'] += 2;
  if (/\b(integration test)\b/.test(lower)) scores['e2e'] += 2;

  // REFACTOR signals
  if (/\b(refactor|clean ?up|dead code|remove unused|consolidat|simplif|technical debt|tech debt)\b/.test(lower)) scores['refactor'] += 3;
  if (/\b(duplicat|redundan|deprecat)\b/.test(lower)) scores['refactor'] += 2;

  // --- FIND WINNER ---
  let bestCategory = null;
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // Minimum confidence threshold
  if (bestScore < 3) return;

  // If new-project wins but GSD project exists, redirect to plan-phase
  if (bestCategory === 'new-project' && hasGsdProject) {
    bestCategory = 'plan-phase';
  }

  const routes = {
    'new-project': '[LYRA] Suggested: /gsd:new-project',
    'plan-phase': '[LYRA] Suggested: /gsd:plan-phase',
    'debug': '[LYRA] Suggested: /gsd:debug',
    'code-review': '[LYRA] Suggested: @code-reviewer',
    'security': '[LYRA] Suggested: @security-reviewer',
    'build-error': '[LYRA] Suggested: @build-error-resolver',
    'e2e': '[LYRA] Suggested: @e2e-runner',
    'refactor': '[LYRA] Suggested: @refactor-cleaner',
  };

  process.stdout.write(routes[bestCategory]);
}

main();
