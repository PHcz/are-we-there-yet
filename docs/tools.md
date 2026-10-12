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

Known gaps are collected in [Limitations](limitations.md).

## Tested versions

| Tool | Version checked |
|---|---|
| Claude Code | 2.1.28x |
| Codex CLI | 0.160 |
| Antigravity CLI | 1.2.16 |

Other versions may work. Codex needs a version that supports hooks; older ones ignore them. Node.js 20 or newer is required for all tools.

**`agy`** is the command name of Antigravity CLI, so `awty install agy` installs the hooks for Antigravity. Antigravity keeps its settings under `~/.gemini/`, and awty adds its hooks to `~/.gemini/config/hooks.json`.

## Claude Code

`awty install claude` adds this package as a local Claude Code plugin marketplace and installs the plugin. Start a new session, or type `/reload-plugins`.

## Codex CLI

```bash
awty install codex
```

This adds three entries to `~/.codex/hooks.json` (or `$CODEX_HOME/hooks.json`): `UserPromptSubmit`, `PermissionRequest` and `Stop`. **Codex asks you to approve hooks** when they are new or their command changes. Accept them, or type `/hooks` in Codex.

Inside a Codex session, type `awty status`, `awty off`, `awty test` and so on **without a leading slash**. Codex rejects unknown `/` commands before hooks can see them. Any prompt starting with the word `awty` is handled as a command.

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

## Install details

What `awty install <tool>` changes:

| Tool | Change |
|---|---|
| `claude` | Always runs `claude plugin marketplace add <this package's folder>` and `claude plugin install are-we-there-yet@are-we-there-yet-local`. If the plugin was already installed, it then also runs `claude plugin marketplace update are-we-there-yet-local` and `claude plugin update are-we-there-yet@are-we-there-yet-local`. User-wide only. |
| `codex` | Adds (or replaces) its three entries in `hooks.json`. Your other hooks are left alone. Hooks have no awty-set time limit. |
| `agy` | Adds an `are-we-there-yet` key to `hooks.json` with a `PreToolUse` hook (matcher `ask_question\|ask_permission`) and a `Stop` hook, each with a 10 second limit. |

Running install again is safe: it replaces awty's own entries and doesn't duplicate them.

**When it refuses.** The installer changes nothing and prints a message when:

| Situation | Message |
|---|---|
| The hooks file isn't valid JSON, or its top level isn't an object | `<file> is not valid JSON (<reason>); fix it by hand first` |
| The file has the wrong shape | `<file>: "hooks" is not an object; fix it by hand first` (or `"hooks.Stop" is not an array`, and so on) |
| `awty install claude --project` | `Claude Code plugins install per user; --project is not supported for claude` |
| No tool given, or an unknown one | `which tool? use: awty install <claude\|codex\|agy>` (`awty uninstall <…>` for uninstall) or `unknown tool "x" (use claude, codex or agy)` |
| `claude plugin marketplace add` fails | `claude plugin marketplace add failed: <output>` |
| `claude plugin install` fails | `claude plugin install failed: <output>` |
| `claude plugin uninstall` fails (`awty uninstall claude`) | `claude plugin uninstall failed: <output>` |
| The `claude` command isn't on your `PATH` | `claude not found on PATH.` followed by the two commands to run yourself (below) |

If `awty install claude` can't run, do it by hand. Replace the folder with where awty lives:

```bash
claude plugin marketplace add ~/are-we-there-yet
```

```bash
claude plugin install are-we-there-yet@are-we-there-yet-local
```

**How files are written.** Hooks files are written atomically (a temporary file is swapped in), keep their permissions and follow symlinks, so a dotfiles-managed `hooks.json` stays a link. Before its first change to a file, the installer saves a copy as `<file>.awty-backup`.

## Upgrading and uninstalling

**Update.** Run `npm install -g @phcz/are-we-there-yet@latest` (or `git pull` in your clone), then re-run `awty install <tool>` for each tool you use. This refreshes the hook paths and updates the Claude Code plugin.

**Claude Code keeps a cached copy of the plugin** and only refreshes it when the version number changes. If Claude doesn't pick up a change, run `awty uninstall claude && awty install claude`.

**Uninstall from a tool.** Only are-we-there-yet's own entries are removed; your other hooks stay.

```bash
awty uninstall codex
awty uninstall agy
awty uninstall claude
```

For Claude Code this runs `claude plugin uninstall are-we-there-yet@are-we-there-yet-local` and then removes the local marketplace. If you installed into a project with `--project`, remove it with `awty uninstall <tool> --project` from that folder.

**Remove the package** (`npm uninstall -g @phcz/are-we-there-yet`, or deleting your clone and running `npm unlink -g @phcz/are-we-there-yet`) only after uninstalling from every tool. Otherwise the hooks stay behind pointing at a file that no longer exists.

Other things to know:

- Before its first change to a file, the installer saves a copy next to it as `<file>.awty-backup`. That backup is of the file as it was before awty's first change, so it may be old; later changes don't update it.
- After switching Node versions with nvm or Volta, re-run `awty install …` for each tool, because the package may now live in a different folder.
- `awty status` marks hooks whose path is out of date as `installed (stale path — re-run awty install <tool>)`.

## Removing everything

First run `awty uninstall <tool> --project` in each project where you used `--project`. Then run `awty uninstall` for each tool and remove the package, and delete what is left:

1. The data folder, which holds your global config, session state and logs:

```bash
rm -r ~/.config/are-we-there-yet
```

2. Keychain entries you created (one command per name you used, e.g. `awty-telegram`):

```bash
security delete-generic-password -s awty-telegram
```

3. Backup files next to the tool configs: `~/.codex/hooks.json.awty-backup`, `~/.gemini/config/hooks.json.awty-backup`, and any `*.awty-backup` in project folders.
4. Project settings files you created: `<project>/.claude/awty.json`.
5. Any `export …` lines you added to your shell profile for `env:` secrets.

Notes:

- The settings folder is `$AWTY_HOME` if you set it, and Codex's hooks file is under `$CODEX_HOME` if you set it.
- A project-level uninstall can leave an almost empty `.codex/hooks.json` (`{"hooks": {}}`) or `.agents/hooks.json` and their folders, which you can delete.
