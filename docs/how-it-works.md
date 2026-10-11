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
- **Codex CLI.**
  - Codex only runs hooks you've approved. It asks when the hooks are new or their command changes; you can also type `/hooks`.
  - The Waiting message shows Codex's own description of what it wants to do, e.g. "May I write hello.txt…?".
- **Antigravity CLI.**
  - Antigravity runs its pre-tool hook for every command, including auto-approved ones, and doesn't say when it's waiting for your approval. To avoid false alarms, only explicit questions send a Waiting message.
  - are-we-there-yet never returns a permission decision to Antigravity, so it can't change what the agent is allowed to do.

A fuller comparison and the install steps are in [Supported tools](tools.md).

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
| 1 | a name you set with `/awty name="…"` | a name you set with `awty name="…"` | — |
| 2 | the session title, if you used `/rename` | Codex's automatic thread title | — |
| 3 | `<project folder> · <first 6 words of your first message>` | same | same |

**Summary:**

- **Done:** the agent's last message. Claude Code and Codex pass it to the hook directly. For Antigravity it's read from the session transcript.
- **Waiting:** the question followed by `• option` lines, or the permission request.
- **Paused** (Claude Code): the list of background jobs still running, then Claude's last message.

Every summary keeps its line breaks and bullets and is limited to 8 lines and `summary.maxChars` characters (300 by default). Optionally, Done can use a one-line AI summary instead; see [Summaries](configuration.md#summaries).

**Layout per channel:** Telegram (HTML), Slack and Discord get the formatted card. Push channels (ntfy, Pushover, Bark, Gotify, Home Assistant, macOS, Apprise) get the title `✅ Done · 4m 12s · auth refactor (Codex)`, with the summary plus `api · 14:32` as the body. If Telegram ever rejects the formatting, the same message is resent as plain text.

## Sending without slowing the agent down

1. The tool runs the hook and passes it details about the event.
2. The hook decides, in a few milliseconds, whether a message should go out: it checks your settings and filters.
3. If yes, it writes a small job file and starts a **separate background process** to send it, then exits immediately.
4. The background process builds the summary, sends to all channels in parallel (each with an 8-second time limit), logs any failure and deletes the job file.

A slow or broken channel therefore never holds up your session, and one failing channel doesn't stop the others. The hook always exits successfully, even when something goes wrong, so it can never interrupt the agent.

## Changing settings without using tokens

| Tool | In a session | How it works |
|---|---|---|
| Claude Code | `/awty …` | The `UserPromptSubmit` hook recognises the command, applies it, and blocks the message so it never reaches Claude. Claude Code shows the hook's reply instead, in a "hook blocked your prompt" box. |
| Codex CLI | `awty …` (no slash) | Same mechanism. Codex rejects unknown `/` commands before hooks run, so the command is typed without the slash. Codex shows "Blocked by hook" with the reply. |
| Antigravity CLI | — | Antigravity has no prompt hook, so there is no in-session command. |
| Any tool | `awty status`, `awty set global …`, `awty set project …` in a terminal | The `awty` command edits the same settings files directly. |

Settings typed inside a session apply to that session only, unless you add `global` or `project`. See [Configuration](configuration.md).

## Files on your disk

Everything lives in `~/.config/are-we-there-yet/` (or `$AWTY_HOME`), shared by all tools:

| Path | What |
|---|---|
| `config.json` | Your global settings |
| `sessions/<id>.json` | Per-session state: in-session overrides, start time of the current request, when the last message was sent. Deleted after 14 days. Codex and Antigravity sessions are stored as `codex_<id>.json` and `agy_<id>.json`. |
| `jobs/` | Messages waiting to be sent. Each file lives for a fraction of a second. |
| `error.log` | Last 200 errors. `awty status` and `/awty` show the newest. |

All files are created readable only by you.

The hooks themselves are registered in each tool's own configuration: the Claude Code plugin, `~/.codex/hooks.json`, and `~/.gemini/config/hooks.json` for Antigravity. `awty install` and `awty uninstall` manage those entries; see [Supported tools](tools.md).

## Privacy

- Message text (the agent's last reply, truncated, plus the project folder name) is sent to the channels you enabled and nowhere else.
- With `summary=llm`, the text to summarise is sent to Claude Haiku through your own `claude` CLI login, as a separate short session. For Claude Code that's the end of the conversation. For Codex and Antigravity it's the agent's last message. This needs the `claude` CLI installed; without it, the normal last-message summary is used.
- Secrets written as `keychain:`/`env:` are read only when sending and are never logged.

## Requirements

- At least one of: Claude Code, Codex CLI (a version with hooks) or Antigravity CLI
- Node.js 20 or newer. The hook finds it on your `PATH`, or at `/opt/homebrew/bin/node`, `/usr/local/bin/node` or `~/.volta/bin/node`.
- macOS for the `macos` channel, `onlyWhenAwaySec` and `keychain:` secrets. Everything else works on Linux too.
