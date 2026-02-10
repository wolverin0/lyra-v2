# Lyra v2

**Auto-routes your Claude Code prompts to the right workflow.** Instead of remembering which command or agent to use, just describe what you need — Lyra figures out the rest.

## Before / After

**Without Lyra:** You type "build me a chat app" → Claude starts coding randomly, no structure.

**With Lyra:** You type "build me a chat app" → Claude shows `Lyra -> /gsd:new-project` → Automatically starts the structured project workflow with requirements gathering, roadmap, and phased execution.

## Quick Install

```bash
git clone https://github.com/wolverin0/lyra-v2.git
cd lyra-v2
node install.js
```

Then **restart Claude Code**. That's it.

> The installer copies 3 hook files and patches your `settings.json` (backup saved automatically).
> Works on Windows and macOS/Linux. Requires Node.js 18+.

### One more step (important)

Add this to your `CLAUDE.md` (project or global `~/.claude/CLAUDE.md`):

```markdown
## Lyra Prompt Router (MANDATORY)

A command hook injects `[LYRA ROUTING]` into system-reminders when a prompt needs routing.
The user CANNOT see system-reminders, so you must announce routing decisions.

When you see `[LYRA ROUTING]`:
1. FIRST line of response: "Lyra -> {skill}"
2. IMMEDIATELY invoke the Skill tool with that skill
3. Do NOT enter generic plan mode or ask questions first

When there is NO `[LYRA ROUTING]`: respond normally.
```

This tells Claude to announce routing to you (since hook output is invisible to users).

## What gets routed

| You say something like... | Lyra routes to | What happens |
|--------------------------|---------------|--------------|
| "Build a chat app with auth and realtime" | `/gsd:new-project` | Requirements gathering → roadmap → phased build |
| "Add payment processing to the app" | `/gsd:plan-phase` | Structured planning for complex feature |
| "Login crashes with CORS errors on the auth endpoint" | `/gsd:debug` | Systematic debugging with state tracking |
| "Review the auth module code" | `@code-reviewer` | Specialized code review agent |
| "Check for XSS vulnerabilities" | `@security-reviewer` | Security audit agent |
| "Build fails with TS2304 errors" | `@build-error-resolver` | Build error specialist |
| "Write playwright tests for checkout" | `@e2e-runner` | E2E testing agent |
| "Clean up dead code in utils" | `@refactor-cleaner` | Cleanup specialist |
| "Help me improve this app" | `@architect` | Architecture & optimization analysis |
| "What features should I add next?" | `brainstorming` | Creative exploration of ideas |
| "What does useEffect do?" | _(no routing)_ | Claude responds normally |

**Most prompts get NO routing** — simple questions, quick edits, and conversations pass through untouched.

## How it works

Lyra installs 3 small hooks that run when you submit a prompt:

1. **Context hook** — detects your tech stack (React, Express, etc.) and GSD project state
2. **Router hook** — injects a classification instruction into Claude's context
3. **Quality gate** (at session end) — warns about `console.log` and uncommitted changes

The key insight: **Claude itself does the classification.** The router doesn't use keywords or external API calls — it just tells the session model (Opus/Sonnet) "classify this prompt into one of these categories." The model already understands your intent better than any keyword matcher could.

```
You type a prompt
    ↓
Router checks: is it short/trivial? → skip (no overhead)
    ↓
Router injects: [LYRA ROUTING] + categories
    ↓
Claude classifies your intent
    ↓
Match found → "Lyra -> /gsd:new-project" + invokes workflow
No match   → responds normally
```

**Cost:** Zero. No external API calls.
**Latency:** <1ms for the hook. Classification happens as part of Claude's normal response.
**Accuracy:** As good as the model you're using — Opus/Sonnet understand intent far better than regex.

## Uninstall

```bash
cd lyra-v2
node install.js --uninstall
```

Removes hooks from `settings.json` and deletes hook files. Your backup is at `settings.json.lyra-backup`.

## Works well with

- **[GSD](https://github.com/coleam00/gsd)** — Lyra routes to GSD commands for structured project execution
- **Claude Code agents** — routes to built-in agents (@code-reviewer, @security-reviewer, etc.)
- **[claude-mem](https://github.com/thedotmack/claude-mem)** — persistent cross-session memory

## License

MIT
