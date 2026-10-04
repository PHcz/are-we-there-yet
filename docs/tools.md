# Supported tools

| | Claude Code | Codex CLI | Antigravity CLI |
|---|---|---|---|
| ✅ Done | ✔ | ✔ | ✔ |
| ❓ Agent asks you a question | ✔ | — (Codex has no question tool) | ✔ (`ask_question`, `ask_permission`) |
| ⏳ Waiting for permission | ✔ | ✔ | — (not exposed by Antigravity; see below) |
| Session name | your `/rename` title, else project · first prompt | Codex's automatic thread title | project · first prompt |
| Change settings in a session | `/awty …` | `awty …` (no slash) | — use `awty` in a terminal |
| Install | `awty install claude` (or the Claude plugin commands) | `awty install codex` | `awty install agy` |

Messages from Codex and Antigravity show the tool name first: `✅ [Codex · Fix login bug] Done · 3m10s`.

## Claude Code

`awty install claude` adds this package as a local Claude Code plugin marketplace and installs the plugin. Start a new session, or type `/reload-plugins`.

## Codex CLI

```bash
awty install codex
```

This adds three entries to `~/.codex/hooks.json`: `UserPromptSubmit`, `PermissionRequest` and `Stop`. **Codex asks you to approve new hooks** the next time it starts. Accept them, or type `/hooks` in Codex. Codex asks again whenever the hooks change, for example after you reinstall or update awty.

Inside a Codex session, type `awty status`, `awty off`, `awty test` and so on **without a leading slash**. Codex rejects unknown `/` commands before hooks can see them.

`awty install codex --project` writes `.codex/hooks.json` in the current folder instead.

## Antigravity CLI

```bash
awty install agy
```

This adds an entry named `are-we-there-yet` to `~/.gemini/config/hooks.json`, the global hooks file shared by Antigravity CLI, Antigravity 2.0 and the Antigravity IDE. Check it in Antigravity with `/hooks`.

Limitations:
- **Command approvals ("Run this command?") don't send a Waiting message.** Antigravity runs its hook for every command, including ones that are auto-approved, and doesn't report when it's waiting for you, so alerting on them would cause false alarms. You get a Waiting message when the agent explicitly asks you something, and a Done message when the turn ends.
- **No in-session command.** Antigravity has no prompt hook. Use `awty status` and `awty set …` in a terminal.
- `awty install agy --project` writes `.agents/hooks.json`, but Antigravity CLI is reported to ignore workspace hooks, so prefer the global install.

are-we-there-yet never returns a permission decision to Antigravity, so it can't change what the agent is allowed to do.

## Uninstall

```bash
awty uninstall codex
awty uninstall agy
awty uninstall claude
```

Only are-we-there-yet's own entries are removed. Before its first change to a file, the installer saved a copy next to it as `<file>.awty-backup`.
