#!/usr/bin/env node
// Lyra v2 Router — Intent classification via prompt injection
// Reads categories from lyra-config.json so users can customize their own routes.
// The main session model classifies and routes — no external API calls needed.

const fs = require('fs');
const path = require('path');

function loadConfig() {
  const locations = [
    path.join(__dirname, 'lyra-config.json'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'hooks', 'lyra-config.json'),
  ];

  for (const loc of locations) {
    try {
      return JSON.parse(fs.readFileSync(loc, 'utf8'));
    } catch {}
  }
  return null;
}

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
  if (lower.startsWith('/')) return;
  if (lower.startsWith('git ')) return;
  if (/^(yes|no|ok|sure|thanks|done|stop|cancel|continue|go ahead|looks good|commit|push|pull|merge|deploy)/i.test(lower)) return;

  // Simple questions — no routing needed
  const isQuestion = /^(what|how|why|where|when|who|can|does|is |are |do |did |should|could|would|which|explain|show|list|tell|describe|find|get|read)\b/i.test(lower);
  if (isQuestion && lower.length < 100) return;

  // Load config
  const config = loadConfig();
  if (!config || !config.categories || config.categories.length === 0) return;

  // Check GSD project context for new-project redirect
  const hasGsdProject = fs.existsSync(path.join(process.cwd(), '.planning', 'STATE.md'));

  // Build classification instruction from config
  const categoryLines = config.categories.map(cat => {
    let line = `- ${cat.route} → ${cat.description}`;
    if (cat.examples && cat.examples.length > 0) {
      line += `. Examples: ${cat.examples.map(e => `"${e}"`).join(', ')}`;
    }
    if (cat.route === '/gsd:new-project' && hasGsdProject) {
      line += '\n  (NOTE: .planning/STATE.md exists — use /gsd:plan-phase for new features on THIS project)';
    }
    return line;
  });

  const ruleLines = (config.rules || []).map(r => `KEY: ${r}`).join('\n');

  const instruction = `[LYRA ROUTING] MANDATORY — classify BEFORE responding.

STOP. Before you do ANYTHING else, classify this prompt:

CATEGORIES (with examples):
${categoryLines.join('\n')}
- NONE → Questions, quick edits, conversations, follow-ups, confirmations

${ruleLines}

ACTION:
- Not NONE → FIRST line: "Lyra -> {skill}", then invoke Skill tool IMMEDIATELY
- NONE → respond normally, never mention Lyra`;

  process.stdout.write(instruction);
}

main();
