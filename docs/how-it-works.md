# How it works

are-we-there-yet is a Claude Code plugin made of **hooks**: small scripts that Claude Code itself runs when certain things happen in a session. Claude doesn't decide when to notify you, so notifications are reliable and cost no tokens.

## What triggers a message

| Claude Code event | Message | When |
|---|---|---|
| `Stop` | ✅ **Done** | Claude finished responding and handed control back to you |
| `PreToolUse` on `AskUserQuestion` | ❓ **Waiting for you** | Claude asked a multiple-choice question. Sent immediately, with the question and options. |
| `Notification` (`permission_prompt`, `elicitation_dialog`, `agent_needs_input`) | ⏳ **Waiting for you** | Claude needs permission to run a tool, or an MCP server is asking for input |
| `UserPromptSubmit` | — | Records when your request started, which is used for the "took 4m12s" duration, and handles `/awty` commands |

The table shows Claude Code's events. For the Codex CLI and Antigravity events, see [Supported tools](tools.md).

Claude Code also sends an "idle" notification about a minute after every finished turn. The plugin ignores it, because the Done message already covers that moment and it would otherwise send a second ping each time.

## What a message contains

```
✅ [auth refactor] Done · 4m12s          ← icon, session name, duration
JWT rotation is in place and all…        ← summary
📁 ~/code/api · 14:32                    ← project folder and time
```

**Session name**, first match wins:

1. a name you set with `/awty name="…"`
2. the session title, if you named the session with `/rename`
3. `<project folder> · <first 6 words of your first message>`

**Summary**: Claude's last message, or for waiting alerts the question or permission text. Optionally it can be a one-line AI summary; see [Summaries](configuration.md#summaries).

Chat channels (Telegram, Slack, Discord) receive the whole block as one message. Push channels (ntfy, Pushover, Bark, Gotify, Home Assistant, macOS) get the first line as the notification title and the rest as its body.

## Sending without slowing Claude down

1. Claude Code runs the hook and passes it details about the event.
2. The hook decides, in a few milliseconds, whether a message should go out: it checks your settings and filters.
3. If yes, it writes a small job file and starts a **separate background process** to send it, then exits immediately.
4. The background process builds the summary, sends to all channels in parallel (each with an 8-second time limit), logs any failure and deletes the job file.

A slow or broken channel therefore never holds up your session, and one failing channel doesn't stop the others. The hook always exits successfully, even when something goes wrong, so it can never interrupt Claude.

## `/awty` without using tokens

When you type a message starting with `/awty`, the `UserPromptSubmit` hook recognises it, applies the change, and blocks the message from going to Claude. Claude Code shows you the hook's reply instead. The plugin also ships an `awty` command file, but it's only a fallback that explains what's wrong if the hook didn't run.

## Files on your disk

Everything lives in `~/.config/are-we-there-yet/` (or `$AWTY_HOME`):

| Path | What |
|---|---|
| `config.json` | Your global settings |
| `sessions/<id>.json` | Per-session state: `/awty` overrides, start time of the current request, when the last message was sent. Deleted after 14 days. |
| `jobs/` | Messages waiting to be sent. Each file lives for a fraction of a second. |
| `error.log` | Last 200 errors. `/awty` shows the newest. |

All files are created readable only by you.

## Privacy

- Message text (Claude's last reply, truncated, plus the project folder name) is sent to the channels you enabled and nowhere else.
- With `summary=llm`, the end of the conversation is sent to Claude Haiku via your own `claude` CLI login to write the one-line summary. This runs as a separate short Claude session.
- Secrets written as `keychain:`/`env:` are read only when sending and are never logged.

## Requirements

- Claude Code, Codex CLI (with hooks) or Antigravity CLI
- Node.js 20 or newer. The hook finds it on your `PATH`, or at `/opt/homebrew/bin/node`, `/usr/local/bin/node` or `~/.volta/bin/node`.
- macOS for the `macos` channel, `onlyWhenAwaySec` and `keychain:` secrets. Everything else works on Linux too.
