# How it works

are-we-there-yet works with **Claude Code**, **OpenAI Codex CLI** and **Google Antigravity CLI**. For each tool it installs **hooks**: small scripts that the tool itself runs when certain things happen in a session. The agent doesn't decide when to notify you, so notifications are reliable and cost no tokens.

All three tools feed the same pipeline. A small adapter per tool translates that tool's event into a common one (prompt, question, waiting, done). From there the filters, summary, message layout and channels are shared.

```
Claude Code  ─┐
Codex CLI    ─┼─►  adapter  ─►  filters  ─►  summary + layout  ─►  your channels
Antigravity  ─┘
```

## What triggers a message

| Message | Claude Code | Codex CLI | Antigravity CLI |
|---|---|---|---|
| ✅ **Done**: the agent finished and handed control back | `Stop` | `Stop` | `Stop`, once the agent is fully idle |
| ⏸ **Paused**: the turn ended but background jobs are still running | `Stop` while jobs started with `run_in_background` haven't reported back | — | — |
| ❓ **Waiting**: the agent asked you a question | `PreToolUse` on `AskUserQuestion` | — (Codex has no question tool) | `PreToolUse` on `ask_question` / `ask_permission` |
| ⏳ **Waiting**: the agent needs permission | `Notification` (`permission_prompt`, `elicitation_dialog`, `agent_needs_input`) | `PermissionRequest` | — (Antigravity doesn't expose this) |
| Turn start (used for the duration) | `UserPromptSubmit` | `UserPromptSubmit` | read from Antigravity's transcript |

Details per tool:

- **Claude Code.**
  - Claude Code also sends an "idle" notification about a minute after every finished turn. are-we-there-yet ignores it, because the Done message already covers that moment.
  - When a background job or subagent finishes, Claude Code wakes the session with an injected message. That isn't treated as a new request, so the Done at the real end still shows the full duration.
  - If another hook forced Claude to continue after a `Stop` (`stop_hook_active`), no Done is sent for that `Stop`.
- **Codex CLI.**
  - Codex only runs hooks you've approved. It asks when the hooks are new or their command changes; you can also type `/hooks`.
  - The Waiting message shows Codex's own description of what it wants to do, e.g. "May I write hello.txt…?".
  - As in Claude Code, no Done is sent for a `Stop` that another hook forced to continue (`stop_hook_active`).
  - Any prompt whose first word is `awty` is treated as an awty command and never reaches the model, even if you meant it as a normal request. See [Limitations](limitations.md).
  - `CODEX_HOME` is honoured: it decides where awty looks for Codex's `hooks.json` and thread titles.
- **Antigravity CLI.**
  - Antigravity runs its pre-tool hook for every command, including auto-approved ones, and doesn't say when it's waiting for your approval. To avoid false alarms, only explicit questions send a Waiting message.
  - are-we-there-yet never returns a permission decision to Antigravity, so it can't change what the agent is allowed to do.

A fuller comparison and the install steps are in [Supported tools](tools.md).

### Paused (background jobs)

Claude Code can leave a turn while work it started in the background is still running. awty sends ⏸ **Paused** instead of Done in that case.

- A background job is a tool call made with `run_in_background` (for example a long shell command or a background subagent) that hasn't reported back yet.
- The message lists each job on its own line, then Claude's last message. A job's label is its description if it has one, otherwise its command, cut to 60 characters.
- awty reads only the recent part of the transcript (the last 512 KB), so jobs started long ago may not be found.
- Each time Claude wakes up and stops again while jobs remain, you get one more Paused.
- If a job is killed without reporting back (for example you closed the session), the transcript never shows it as finished, so a later Paused can list it again. See [Limitations](limitations.md).
- Paused follows the Done filters, except the debounce. See [Which filters apply to which message](configuration.md#which-filters-apply-to-which-message).

## What a message contains

```
✅ Done · 4m 12s                         ← status and duration
auth refactor · Codex                    ← session name, and the tool (not shown for Claude Code)

┃ JWT rotation is in place.              ← summary with line breaks
┃ • all 42 tests pass                       and bullets kept
┃ • updated README

api · 14:32                              ← project folder and time
```

**Session name**, first match wins:

| | Claude Code | Codex CLI | Antigravity CLI |
|---|---|---|---|
| 1 | a name you set with `/awty name="…"` | a name you set with `awty name="…"` | a `name` set with `awty set project name="…"` or in the global config (applies to every Antigravity session; there is no per-session name) |
| 2 | the session title, if you used `/rename` | Codex's automatic thread title | — |
| 3 | `<project folder> · <first 6 words of your first message>` | same | same |

The first 200 characters of your first prompt in each session are kept in `sessions/<id>.json` so the name stays stable. They are deleted with the session file after 14 days. Nothing else of your prompts is stored.

**Summary:**

- **Done:** the agent's last message. Claude Code and Codex pass it to the hook directly. For Antigravity it's read from the session transcript.
- **Waiting:** the question followed by `• option` lines, or the permission request.
- **Paused** (Claude Code): the list of background jobs still running, then Claude's last message.

Every summary keeps its line breaks and bullets and is limited to 8 non-empty lines and `summary.maxChars` characters (300 by default). Optionally, Done can use a one-line AI summary instead; see [Summaries](configuration.md#summaries).

**Layout per channel:** Telegram (HTML), Slack and Discord get the formatted card. Push channels (ntfy, Pushover, Bark, Gotify, Home Assistant, macOS, Apprise) get the title `✅ Done · 4m 12s · auth refactor (Codex)`, with the summary plus `api · 14:32` as the body. If Telegram ever rejects the formatting, the same message is resent as plain text.

## Sending without slowing the agent down

1. The tool runs the hook and passes it details about the event.
2. The hook decides, in a few milliseconds, whether a message should go out: it checks your settings and filters.
3. If yes, it writes a small job file and starts a **separate background process** to send it, then exits immediately.
4. The background process builds the summary, sends to all channels in parallel, logs any failure and deletes the job file.

A slow or broken channel therefore never holds up your session, and one failing channel doesn't stop the others. The hook always exits successfully, even when something goes wrong, so it can never interrupt the agent.

Limits and behaviour to know:

- **Time limits.** Each channel gets 8 seconds (the macOS banner 5 seconds). The hook itself has a 10 second limit in Claude Code and Antigravity (set by awty); Codex applies its own default.
- **No retries.** If a send fails (network down, wrong token), awty writes the error to `error.log` and drops the message.
- **Summary with `summary=llm`** runs `claude -p --model haiku` inside the background process, with a 15 second limit.

## Changing settings without using tokens

| Tool | In a session | How it works |
|---|---|---|
| Claude Code | `/awty …` | The `UserPromptSubmit` hook recognises the command, applies it, and blocks the message so it never reaches Claude. Claude Code shows the hook's reply instead, in a "hook blocked your prompt" box. |
| Codex CLI | `awty …` (no slash) | Same mechanism. Codex rejects unknown `/` commands before hooks run, so the command is typed without the slash. Codex shows "Blocked by hook" with the reply. |
| Antigravity CLI | — | Antigravity has no prompt hook, so there is no in-session command. |
| Any tool | `awty status`, `awty set global …`, `awty set project …` in a terminal | The `awty` command edits the same settings files directly. |

Settings typed inside a session apply to that session only, unless you add `global` or `project`. See [Configuration](configuration.md).

## The decision log

Every time a hook reaches the filters, awty records what it decided in `decisions.log`. `awty status` (in a terminal) shows the last 5 under `Recent:`:

```
Recent:
  2026-10-11T14:32:05.123Z claude done sent · api
  2026-10-11T14:35:40.456Z codex done skipped: too short (41s < 60s) · api
```

Each line is `<time> <tool> <kind> <outcome> · <name>`. `kind` is `done`, `waiting` or `paused`. The name is never taken from your prompts: it is the `name` you set, Codex's thread title, or the project folder name. The file keeps the last 100 lines and contains no message text.

| Outcome | Meaning |
|---|---|
| `sent` | The message was handed to your channels. If it didn't arrive, check `Last error` in `awty status`. |
| `no channels configured` | The filters passed but `channels` is empty, so nothing was sent. |
| `skipped: notifications off` | `enabled` is `false` (`/awty off`, at any layer). |
| `skipped: done messages off` / `waiting messages off` / `paused messages off` | That kind's switch is off. |
| `skipped: too short (41s < 60s)` | The task was shorter than `filters.minDurationSec`. |
| `skipped: debounced (last Done 20s ago, limit 60s)` | Another Done was sent within `filters.debounceSec`. |
| `skipped: you were active (idle 12s < 120s)` | You used the keyboard or mouse more recently than `filters.onlyWhenAwaySec`. |
| `skipped: duplicate of a question alert` | A ⏳ permission alert came within 2 minutes of a ❓ question alert for the same session. |

Events that can never produce a message (for example an Antigravity `Stop` while the agent isn't idle, or a Claude Code "idle" notification) are not logged. What to do about each reason is in [Why didn't I get a message?](troubleshooting.md#why-didnt-i-get-a-message).

## Files on your disk

Everything lives in `~/.config/are-we-there-yet/` (or `$AWTY_HOME`), shared by all tools:

| Path | What |
|---|---|
| `config.json` | Your global settings |
| `sessions/<id>.json` | Per-session state: in-session overrides, start time of the current request, when the last message was sent, and the first 200 characters of your first prompt (used for the session name). Deleted after 14 days. Codex and Antigravity sessions are stored as `codex_<id>.json` and `agy_<id>.json`. |
| `jobs/` | Messages waiting to be sent. Each file lives for a fraction of a second. |
| `error.log` | Last 200 errors. `awty status` and `/awty` show the newest. |
| `decisions.log` | Last 100 decisions: sent or skipped, and why. No message text. See [The decision log](#the-decision-log). |

Files that awty creates are readable only by you. A `config.json` you write by hand keeps the permissions you gave it; run `chmod 600` on it.

The hooks themselves are registered in each tool's own configuration: the Claude Code plugin, `~/.codex/hooks.json`, and `~/.gemini/config/hooks.json` for Antigravity. `awty install` and `awty uninstall` manage those entries; see [Supported tools](tools.md).

## Privacy

- **What a message can contain.** Everything below goes to the channels you enabled, and nowhere else:
  - the session name, which can include the first words of your first prompt
  - the agent's last reply (or the part of it that fits the summary limit)
  - question text and option labels
  - the command or description the agent wants permission to run
  - labels of running background jobs, including shell commands
  - the project folder name and the time
- **What stays on your machine.** The first 200 characters of your first prompt per session (in `sessions/<id>.json`, for 14 days), settings, `error.log` and `decisions.log`. The decision log never contains prompt or message text.
- **`summary=llm`.** The text to summarise is sent to Claude Haiku through your own `claude` CLI login, as a separate short session. For Claude Code that's the end of the conversation (up to 4000 characters). For Codex and Antigravity it's the agent's last message. Without the `claude` CLI, the normal last-message summary is used.
- **Secrets.** Write tokens as `keychain:` or `env:` values so they aren't in your config file. They are read only when sending and are never logged. See [Storing secrets](configuration.md#storing-secrets).
- A message sent through a third-party service (Telegram, Slack, Pushover, …) is stored by that service under its own rules. Use a private channel, and think before running an agent on code you can't share.

## Requirements

- At least one of: Claude Code, Codex CLI (a version with hooks) or Antigravity CLI. Tested versions are listed in [Supported tools](tools.md#tested-versions).
- Node.js 20 or newer.
- macOS or Linux. See [Platforms](#platforms).

### How the hook finds Node

The hooks start `bin/run.sh`, a small shell script that looks for Node in this order and uses the first one that exists:

1. `node` on the `PATH` the tool gave the hook
2. `/opt/homebrew/bin/node`
3. `/usr/local/bin/node`
4. `/usr/bin/node`
5. `~/.volta/bin/node`
6. `~/.asdf/shims/node`
7. `~/.local/share/fnm/aliases/default/bin/node`
8. `~/.nvm/versions/node/v*/bin/node`: the highest major version installed

If none is found, the hook does nothing and exits successfully. It appends `hook: node not found (looked on PATH and in common locations)` to `error.log` (skipped once that file is over 64 KB), so check there if no message ever arrives. The script doesn't check the Node version: Node older than 20 fails in other ways.

### Platforms

| | macOS | Linux | Windows |
|---|---|---|---|
| Hooks, filters, all channels except `macos` | ✔ | ✔ | not supported (the hooks are shell scripts); WSL is untested |
| `macos` channel (banners) | ✔ | — | — |
| `onlyWhenAwaySec` | ✔ | ignored: messages are always sent | — |
| `keychain:` secrets | ✔ | — (use `env:`) | — |
| Default channel | `macos` | none: [set a channel first](channels.md) | — |
