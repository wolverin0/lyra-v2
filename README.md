# Lyra v2

Intelligent prompt router for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Uses Haiku to analyze your prompts and suggest optimal workflows — GSD commands, specialized agents, or direct execution.

## What it does

Lyra adds three hooks to your Claude Code installation:

| Hook | Event | What it does |
|------|-------|-------------|
| **Context** | UserPromptSubmit | Injects project state (GSD), debug sessions, and detected stack into every prompt |
| **Router** | UserPromptSubmit | Haiku analyzes your prompt and suggests the best workflow (~0.1 cents/prompt) |
| **Quality Gate** | Stop | Warns about `console.log` in modified files and uncommitted changes |

### Example

You type: _"Build me a user authentication system with OAuth, email/password, and session management"_

Lyra outputs:
```
[LYRA] Suggested: /gsd:new-project — Needs requirements gathering and roadmap
```

You type: _"Fix the typo in the README"_

Lyra outputs: nothing (correctly — this is a simple task).

### Routing table

| Your prompt looks like... | Lyra suggests |
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

- **False positives are worse than false negatives.** Lyra stays silent unless it's confident a workflow applies. You can always invoke commands manually.
- **Suggestions, not mandates.** The `[LYRA]` output is a hint. Claude follows it unless there's a clear reason not to.
- **Context over keywords.** The Haiku prompt hook understands intent, not just regex patterns. "My app crashes when I click login" routes to `/gsd:debug`, not to `@build-error-resolver`.

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

1. Copy `hooks/lyra-context.js` to `~/.claude/hooks/`
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
    │
    ├─► lyra-context.js (command hook, <5ms)
    │   Reads .planning/STATE.md, package.json
    │   Outputs: [Stack: React, TypeScript, Supabase]
    │   Outputs: [GSD Project State] ...
    │
    ├─► Haiku prompt hook (~200ms, ~0.1 cents)
    │   Receives: user prompt + context from above
    │   Returns: { ok: true, reason: "[LYRA] Suggested: ..." }
    │   OR returns: { ok: true, reason: "" } (most prompts)
    │   The reason field becomes visible context to Claude
    │
    └─► Claude receives prompt + all context
        Sees [LYRA] suggestion as additional context
        Follows suggestion or works directly
```

### Why Haiku instead of regex?

The v1 router used regex pattern matching. Problems:
- "Can you evaluate how lyra works" matched `/game/` in the system context → suggested `/gsd:plan-phase` (wrong)
- "I need to fix the build" matched both debug and build-error patterns → ambiguous
- No understanding of negation: "don't build a new project" still matched "build" + "project"

Haiku understands natural language intent. It costs ~0.1 cents per prompt and adds ~200ms latency. Most prompts return empty (fast path).

### Cost

The Haiku prompt hook costs approximately **$0.001 per prompt** (one-tenth of a cent). For a typical 100-prompt session, that's ~$0.10 total.

## Configuration

### Customizing the routing prompt

Edit the `prompt` field in your `settings.json` under `UserPromptSubmit`. The prompt text is in `prompt.txt` for reference.

You can add custom routing patterns:
```
- User mentions deployment/CI/CD → [LYRA] Suggested: @deploy-agent — Deployment workflow needed
```

### Customizing stack detection

Edit `~/.claude/hooks/lyra-context.js` to add more dependency checks. The `checks` array maps npm package names to display labels.

### Disabling specific hooks

Remove the corresponding entry from `settings.json`. Each hook is independent — you can use context injection without the router, or the quality gate without either.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (any version with hooks support)
- Node.js 18+
- Git (for quality gate — optional)

## Works well with

- **[GSD (Get Shit Done)](https://github.com/coleam00/gsd)** — Lyra routes complex prompts to GSD commands for structured execution
- **Claude Code agents** — Lyra routes specific tasks to specialized agents (@code-reviewer, @security-reviewer, etc.)
- **[claude-mem](https://github.com/thedotmack/claude-mem)** — Persistent cross-session memory (Lyra context hook runs alongside claude-mem hooks)

## License

MIT
