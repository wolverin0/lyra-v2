# Lyra v2

Intelligent prompt router for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Analyzes your prompts and suggests optimal workflows — GSD commands, specialized agents, or direct execution.

## What it does

Lyra adds three `UserPromptSubmit` command hooks to your Claude Code installation:

| Hook | What it does |
|------|-------------|
| **Context** | Injects project state (GSD), debug sessions, and detected tech stack into every prompt |
| **Router** | Scores your prompt against 8 workflow patterns and suggests the best match |
| **Quality Gate** (Stop) | Warns about `console.log` in modified files and uncommitted changes at session end |

### Example

You type: _"Build me a user authentication system with OAuth, email/password, and session management"_

Lyra outputs:
```
[LYRA] Suggested: /gsd:new-project
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
- **Scoring, not regex.** Each pattern has multiple signals with weighted scores. A prompt must reach a confidence threshold of 3+ to trigger a suggestion.
- **Negation-aware.** "Don't build a new project" won't match — Lyra checks for negation words before key verbs.
- **GSD-aware.** If a GSD project already exists (`.planning/STATE.md`), "build an app" routes to `/gsd:plan-phase` instead of `/gsd:new-project`.

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
    +-> lyra-context.js (command hook, <5ms)
    |   Reads .planning/STATE.md, package.json
    |   stdout: [Stack: React, TypeScript, Supabase]
    |   stdout: [GSD Project State] ...
    |
    +-> lyra-router.js (command hook, <5ms)
    |   Reads prompt from stdin JSON
    |   Scores against 8 workflow patterns
    |   stdout: [LYRA] Suggested: /gsd:new-project
    |   OR stdout: (nothing - most prompts)
    |
    +-> Claude receives prompt + all stdout as context
        Sees [LYRA] suggestion inline
        Follows suggestion or works directly
```

### Why command hooks?

Claude Code has three hook types: `command`, `prompt`, and `agent`.

For routing, **command hooks are the correct choice** because `UserPromptSubmit` command hook stdout is [added as context that Claude can see](https://code.claude.com/docs/en/hooks). Prompt hooks (`type: "prompt"`) are yes/no gates — their `reason` field is only shown when blocking (`ok: false`), and blocking erases the prompt entirely. That's the opposite of what a router needs.

### Why scoring instead of Haiku?

The v1 router used simple regex. The v2 plan called for Haiku prompt hooks. Testing revealed:
- Prompt hooks can't inject context (they're gates, not injectors)
- Command hooks with scoring are instant (<5ms), free, and 100% reliable
- Scoring with weighted signals, negation detection, and confidence thresholds achieves ~90%+ accuracy

Each category has multiple signals that add to a score. A prompt must reach a threshold of 3+ points to trigger a suggestion. This eliminates most false positives while catching genuine matches.

## Configuration

### Customizing routing patterns

Edit `~/.claude/hooks/lyra-router.js` to modify the scoring engine. Each category has:
- **Signal patterns** (regex or keyword matches) that add points
- **Score thresholds** (default: 3) for triggering suggestions
- **Negation detection** that prevents false matches

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
- **[claude-mem](https://github.com/thedotmack/claude-mem)** — Persistent cross-session memory (Lyra hooks run alongside claude-mem hooks)

## License

MIT
