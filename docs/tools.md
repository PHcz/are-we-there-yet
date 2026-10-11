# Supported tools

| | Claude Code | Codex CLI | Antigravity CLI |
|---|---|---|---|
| ✅ Done | ✔ | ✔ | ✔ |
| ⏸ Paused (background tasks) | ✔ | — | — |
| ❓ Agent asks you a question | ✔ | — (Codex has no question tool) | ✔ (`ask_question`, `ask_permission`) |
| ⏳ Waiting for permission | ✔ | ✔ | — (not exposed by Antigravity; see below) |
| Session name | your `/rename` title, else project · first prompt | Codex's automatic thread title | project · first prompt |
| Change settings in a session | `/awty …` | `awty …` (no slash) | — use `awty` in a terminal |
| Install | `awty install claude` | `awty install codex` | `awty install agy` |

Messages from Codex and Antigravity show the tool next to the session name: `Fix login bug · Codex` on the card, or `✅ Done · 3m 10s · Fix login bug (Codex)` in push notifications. Claude Code sessions show no tool name.

## Claude Code

`awty install claude` adds this package as a local Claude Code plugin marketplace and installs the plugin. Start a new session, or type `/reload-plugins`.

## Codex CLI

```bash
awty install codex
```

This adds three entries to `~/.codex/hooks.json`: `UserPromptSubmit`, `PermissionRequest` and `Stop`. **Codex asks you to approve hooks** when they are new or their command changes. Accept them, or type `/hooks` in Codex.

Inside a Codex session, type `awty status`, `awty off`, `awty test` and so on **without a leading slash**. Codex rejects unknown `/` commands before hooks can see them.

`awty install codex --project` writes `.codex/hooks.json` in the current folder instead.

## Antigravity CLI

```bash
awty install agy
```

This adds an entry named `are-we-there-yet` to `~/.gemini/config/hooks.json`, the global hooks file shared by Antigravity CLI, Antigravity 2.0 and the Antigravity IDE. Check it in Antigravity with `/hooks`.

Limitations:
- **Command approvals ("Run this command?") don't send a Waiting message.** Antigravity runs its hook for every command, including ones that are auto-approved, and doesn't report when it's waiting for you, so alerting on them would cause false alarms. You get a Waiting message when the agent explicitly asks you something, and a Done message when the agent finishes and is idle.
- **No in-session command.** Antigravity has no prompt hook. Use `awty status` and `awty set …` in a terminal.
- `awty install agy --project` writes `.agents/hooks.json`, but Antigravity CLI is reported to ignore workspace hooks, so prefer the global install.

are-we-there-yet never returns a permission decision to Antigravity, so it can't change what the agent is allowed to do.

## Uninstall

```bash
awty uninstall codex
awty uninstall agy
awty uninstall claude
```

Only are-we-there-yet's own entries are removed. Before its first change to a file, the installer saves a copy next to it as `<file>.awty-backup`. That backup is of the file as it was before awty's first change, so it may be old; later changes don't update it.

## Upgrading and uninstalling

- **Update:** run `npm install -g github:PHcz/are-we-there-yet` again (or `git pull` in your clone), then re-run `awty install <tool>` for each tool you use. This refreshes the hook paths and updates the Claude Code plugin.
- **Claude Code keeps a cached copy of the plugin** and only refreshes it when the version number changes. If Claude doesn't pick up a change, run `awty uninstall claude && awty install claude`.
- **Remove:** before `npm uninstall -g @phcz/are-we-there-yet` (or deleting your clone and running `npm unlink -g @phcz/are-we-there-yet`), run `awty uninstall codex`, `awty uninstall agy` and `awty uninstall claude`. Otherwise the hooks stay behind pointing at a file that no longer exists.
- After switching Node versions with nvm or Volta, re-run `awty install …` for each tool, because the package may now live in a different folder.
- `awty status` marks hooks whose path is out of date as `installed (stale path — re-run awty install <tool>)`.
