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
  const instruction = `[LYRA ROUTING] MANDATORY — classify BEFORE responding.

STOP. Before you do ANYTHING else, classify this prompt:

CATEGORIES (with examples):
- /gsd:new-project → User wants to BUILD/CREATE/MAKE something new. Examples: "build a chat app", "create a dashboard", "make a CLI tool", "I want to build a UI to..."${hasGsdProject ? '\n  (NOTE: .planning/STATE.md exists — use /gsd:plan-phase for new features on THIS project)' : ''}
- /gsd:plan-phase → Adding a COMPLEX feature to existing project. Examples: "add authentication to the app", "implement payment processing", "migrate the database"
- /gsd:debug → Bug investigation with symptoms. Examples: "the page crashes when...", "CORS errors on login", "the API returns 500"
- @code-reviewer → Code review request. Examples: "review this code", "check the auth module"
- @security-reviewer → Security audit. Examples: "check for XSS", "security audit", "OWASP compliance"
- @build-error-resolver → Build/compile errors. Examples: "build fails", "TS2304 error", "won't compile"
- @e2e-runner → E2E testing. Examples: "write playwright tests", "e2e test the checkout"
- @refactor-cleaner → Cleanup. Examples: "remove dead code", "refactor the auth module"
- @architect → Architecture, performance, optimization, general improvement. Examples: "improve this app", "optimize performance", "how should I structure this", "make this faster", "find ways to improve"
- brainstorming → Feature ideas, creative exploration, what to build next. Examples: "what features should I add", "brainstorm ideas for", "what should this app do", "help me think about"
- NONE → Questions, quick edits, conversations, follow-ups, confirmations

KEY: If the user says "build", "create", "make", or "I want to build" + ANY noun describing something new, that is /gsd:new-project. Do NOT explore or research first.
KEY: If the user asks to "improve", "optimize", or find ways to make something better, that is @architect.

ACTION:
- Not NONE → FIRST line: "Lyra -> {skill}", then invoke Skill tool IMMEDIATELY
- NONE → respond normally, never mention Lyra`;

  process.stdout.write(instruction);
}

main();
