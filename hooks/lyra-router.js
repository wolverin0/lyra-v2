#!/usr/bin/env node
// Lyra v2 Router — Intent classification via prompt injection
// Runs at UserPromptSubmit as a command hook
//
// Instead of classifying prompts with keywords or external API calls,
// this hook injects a classification instruction into the system context.
// The main session model (Opus/Sonnet) classifies and routes — it already
// understands intent better than any keyword scorer or Haiku call.

const fs = require('fs');
const path = require('path');

function main() {
  let userPrompt = '';
  try {
    const input = fs.readFileSync(0, 'utf8');
    const parsed = JSON.parse(input);
    userPrompt = (parsed.prompt || parsed.message || '').trim();
  } catch { return; }

  const lower = userPrompt.toLowerCase();

  // Fast exits — obviously don't need routing
  if (!lower || lower.length < 30) return;
  if (lower.startsWith('/')) return;  // already a skill invocation
  if (lower.startsWith('git ')) return;
  if (/^(yes|no|ok|sure|thanks|done|stop|cancel|continue|go ahead|looks good|commit|push|pull|merge|deploy)/i.test(lower)) return;

  // Simple questions — no routing needed
  const isQuestion = /^(what|how|why|where|when|who|can|does|is |are |do |did |should|could|would|which|explain|show|list|tell|describe|find|get|read)\b/i.test(lower);
  if (isQuestion && lower.length < 100) return;

  // Check GSD project context
  const hasGsdProject = fs.existsSync(path.join(process.cwd(), '.planning', 'STATE.md'));

  // Inject classification instruction for the main session model
  const instruction = `[LYRA ROUTING]
Classify this user prompt into ONE of these workflows, or NONE:

- /gsd:new-project → Building a NEW app/project/system from scratch${hasGsdProject ? ' (NOTE: .planning/STATE.md exists — use /gsd:plan-phase instead for new features on this project)' : ''}
- /gsd:plan-phase → Adding a COMPLEX multi-file feature to an existing project
- /gsd:debug → Investigating a bug with multiple symptoms or complex behavior
- @code-reviewer → Explicit request to review code quality
- @security-reviewer → Security audit, vulnerability check
- @build-error-resolver → Build failures, type errors, compilation problems
- @e2e-runner → End-to-end testing, Playwright tests
- @refactor-cleaner → Code cleanup, dead code removal, consolidation
- NONE → Simple questions, quick edits, conversations, research

RULES:
1. If classification is NOT "NONE": your FIRST line MUST be "Lyra -> {skill}" (e.g. "Lyra -> /gsd:new-project"), then IMMEDIATELY invoke the Skill tool. Do NOT enter generic plan mode.
2. If classification is "NONE": respond normally, do not mention Lyra.
3. When in doubt, classify as NONE. False positives are worse than false negatives.`;

  process.stdout.write(instruction);
}

main();
