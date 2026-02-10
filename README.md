# Lyra v2

Intelligent prompt router for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Analyzes your prompts and routes them to the optimal workflow — GSD commands, specialized agents, or direct execution.

## What it does

Lyra adds three `UserPromptSubmit` command hooks to your Claude Code installation:

| Hook | What it does |
|------|-------------|
| **Context** | Injects project state (GSD), debug sessions, and detected tech stack into every prompt |
| **Router** | Injects a classification instruction so the main session model routes your prompt intelligently |
| **Quality Gate** (Stop) | Warns about `console.log` in modified files and uncommitted changes at session end |

### Example

You type: _"Build me a user authentication system with OAuth, email/password, and session management"_

Claude responds:
```
Lyra -> /gsd:new-project
```
Then immediately invokes the `/gsd:new-project` workflow.

You type: _"Fix the typo in the README"_

No routing — Claude responds normally.

### Routing table

| Your prompt looks like... | Lyra routes to |
|--------------------------|---------------|
| Build a new app/project from scratch | `/gsd:new-project` |
| Complex multi-file feature | `/gsd:plan-phase` |
| Complex bug with multiple symptoms | `/gsd:debug` |
| Code review request | `@code-reviewer` |
| Security/vulnerability question | `@security-reviewer` |
| Build/compile/type errors | `@build-error-resolver` |
| E2E/integration tests | `@e2e-runner` |
| Refactoring/dead code cleanup | `@refactor-cleaner` |
| Simple question/quick edit/research | _(nothing — no routing needed)_ |

### Design philosophy

- **False positives are worse than false negatives.** Lyra stays silent unless routing clearly applies. You can always invoke commands manually.
- **The best model classifies.** Instead of keyword matching or Haiku API calls, the main session model (Opus/Sonnet) classifies your intent. It already understands context better than any external classifier.
- **No API key needed.** The router injects a classification instruction — the session model does the work. Zero cost, zero latency, zero configuration.
- **GSD-aware.** If a GSD project already exists (`.planning/STATE.md`), the instruction tells Claude to use `/gsd:plan-phase` instead of `/gsd:new-project`.
- **Fast exits save tokens.** Short prompts, slash commands, yes/no responses, and simple questions are filtered out before the instruction is injected — no unnecessary context for trivial prompts.

## Install

### Automated (recommended)

```bash
git clone https://github.com/wolverin0/lyra-v2.git
cd lyra-v2
node install.js
```

The installer:
1. Copies hook files to `~/.claude/hooks/`
2. Backs up your `settings.json` to `settings.json.lyra-backup`
3. Patches `settings.json` to add Lyra hooks
4. Works on Windows (PowerShell) and macOS/Linux (bash)

Restart Claude Code after installing.

### Manual

1. Copy `hooks/lyra-context.js` and `hooks/lyra-router.js` to `~/.claude/hooks/`
2. Copy `hooks/stop-quality-gate.ps1` (Windows) or `hooks/stop-quality-gate.sh` (macOS/Linux) to `~/.claude/hooks/`
3. Add the hook entries from `examples/settings-snippet.json` to your `~/.claude/settings.json`

## Uninstall

```bash
cd lyra-v2
node install.js --uninstall
```

This removes all Lyra hooks from `settings.json` and deletes the hook files.

## How it works

### Architecture

```
User types prompt
    |
    v
[Fast exit check] — short, slash commands, yes/no → skip (no injection)
    |
    v (prompt is substantial)
    |
    +-> lyra-context.js (command hook, <5ms)
    |   Reads .planning/STATE.md, package.json
    |   stdout: [Stack: React, TypeScript, Supabase]
    |   stdout: [GSD Project State] ...
    |
    +-> lyra-router.js (command hook, <1ms)
    |   Outputs classification instruction to stdout
    |   (no external API calls, no keyword matching)
    |
    +-> Claude receives prompt + instructions as context
        Classifies intent using its own understanding
        Routes: "Lyra -> /gsd:new-project" + invokes skill
        OR: responds normally (NONE classification)
```

### Why this approach?

**v1** used regex keyword matching — fast but dumb, missed intent constantly.

**v2 attempt 1** tried Haiku via prompt hooks — failed because prompt hooks are yes/no gates, not context injectors.

**v2 attempt 2** tried Haiku via command hooks with API key — the `claude -p` CLI was too slow (>5s), and direct API calls require an API key.

**v2 final** injects a classification instruction into the session context. The main model (Opus/Sonnet) already has full context and understands intent perfectly. No external calls, no API key, no latency, no keyword lists to maintain.

### Why command hooks?

Claude Code has three hook types: `command`, `prompt`, and `agent`.

For routing, **command hooks are the correct choice** because `UserPromptSubmit` command hook stdout is [added as context that Claude can see](https://code.claude.com/docs/en/hooks). Prompt hooks (`type: "prompt"`) are yes/no gates — their `reason` field is only shown when blocking (`ok: false`), and blocking erases the prompt entirely.

## Configuration

### CLAUDE.md (required)

Add to your project or global CLAUDE.md:

```markdown
## Lyra Prompt Router (MANDATORY)

A command hook injects `[LYRA ROUTING]` into your system-reminders when a prompt
needs classification. **The user CANNOT see system-reminders**, so you must announce routing.

**When you see `[LYRA ROUTING]`:**
1. FIRST line: Show `Lyra -> {skill}` so the user knows routing happened
2. IMMEDIATELY invoke the Skill tool with the specified skill
3. Do NOT enter generic plan mode or ask clarifying questions first

**When there is NO `[LYRA ROUTING]`:** Handle the prompt directly.
```

### Disabling specific hooks

Remove the corresponding entry from `settings.json`. Each hook is independent.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (any version with hooks support)
- Node.js 18+
- Git (for quality gate — optional)

## Works well with

- **[GSD (Get Shit Done)](https://github.com/coleam00/gsd)** — Lyra routes complex prompts to GSD commands
- **Claude Code agents** — routes to specialized agents (@code-reviewer, @security-reviewer, etc.)
- **[claude-mem](https://github.com/thedotmack/claude-mem)** — persistent cross-session memory

## License

MIT
