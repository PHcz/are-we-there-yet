# Troubleshooting

Start with `awty status` in a terminal. It shows your effective settings, the **last error**, the **last 5 decisions** (`Recent:`) and which tools have the hooks installed. Inside a session, `/awty` (Claude Code) or `awty status` (Codex) shows the settings and last error for that session, but not the hooks or recent decisions. The full error log is at `~/.config/are-we-there-yet/error.log`:

```bash
tail -20 ~/.config/are-we-there-yet/error.log
```

## Why didn't I get a message?

Run `awty status` in a terminal and look at `Recent:`. Every time a hook reaches the filters it leaves one line there. Find the line for the session you expected.

**The line says `skipped: …`.** awty decided not to send. Find the reason:

| Reason shown | What it means | Fix |
|---|---|---|
| `notifications off` | Notifications are muted at some layer | `/awty on`, or `awty set global on`; also check `<project>/.claude/awty.json` |
| `done messages off`, `waiting messages off`, `paused messages off` | That kind of message is switched off | `done=on`, `waiting=on` or `paused=on` (see [Choosing which messages you get](configuration.md#choosing-which-messages-you-get)) |
| `too short (41s < 60s)` | The task was shorter than the minimum (default 60 s) | Lower it (`min=10`) or send every Done (`always=on`) |
| `debounced (…)` | Another Done went out within the debounce window | `debounce=0` |
| `you were active (idle 12s < 120s)` | You used the keyboard or mouse more recently than `away=` allows | `away=0` to always send, or a smaller number |
| `duplicate of a question alert` | A ⏳ permission alert came within 2 minutes of the ❓ question alert for the same session | Nothing to fix: you already got the question |

**The line says `no channels configured`.** Filters passed, but `channels` is empty. This is the default on Linux. Add a channel: see [Channels](channels.md).

**The line says `sent` but nothing arrived.** The channel failed. Check `Last error` in `awty status` and the [error table](#nothing-arrives) below, and run `awty test`.

**There's no new line at all.** The hook didn't run, or the event is one awty never reports:

| Cause | How to check | Fix |
|---|---|---|
| Hooks not installed | `awty status` shows `—` for the tool | `awty install <tool>`, then start a new session (Claude Code: or `/reload-plugins`) |
| Node.js not found | `error.log` has `hook: node not found …` | Install Node.js 20+ in one of [the places the hook looks](how-it-works.md#how-the-hook-finds-node) |
| Codex hooks not approved | Codex never asked, or you declined | Type `/hooks` in Codex and accept them |
| Session started before you installed | Hooks are read when a session starts | Start a new session |
| Antigravity: not a question, or not idle | Command approvals never notify; Done is sent only when the agent is fully idle | Expected; see [Limitations](limitations.md) |
| Claude Code: "idle" notification, or a `Stop` that another hook forced to continue | These are ignored on purpose | Expected |
| `AWTY_DISABLE=1` in the environment | `echo $AWTY_DISABLE` | Unset it |

## Claude Code: `/awty` gets an answer from Claude instead of a status reply

The plugin's hooks aren't running in this session.

- **Plugin not installed or disabled:** check `claude plugin list`; it should show `are-we-there-yet … ✔ enabled`.
- **Session started before you installed the plugin:** type `/reload-plugins` or start a new session.
- **Node.js not found:** the hook needs Node.js 20+ in one of [the places it looks](how-it-works.md#how-the-hook-finds-node). When it can't find Node it logs `hook: node not found …` to `error.log`. Check with `node --version`.

## Codex: nothing happens

Codex only runs hooks you have approved. Start Codex and type `/hooks` to review and accept awty's hooks (Codex asks again after the hooks change, e.g. when you reinstall). Then run `awty status` in a terminal and check that `codex` shows `installed`. See [Supported tools](tools.md#codex-cli).

## Antigravity: nothing happens

Type `/hooks` in Antigravity and check that an entry named `are-we-there-yet` is listed under **PreToolUse** and **Stop**. If it isn't, run `awty install agy` and start a new Antigravity session. `awty status` in a terminal should show `agy global installed`. Remember that quick tasks stay silent: by default a Done is only sent for tasks of 60 seconds or more.

## Antigravity: no Waiting message for commands

That's expected. Antigravity doesn't tell hooks when it's waiting for command approval, so only explicit questions (`ask_question`, `ask_permission`) and Done messages are sent. See [Supported tools](tools.md#antigravity-cli).

## Nothing arrives

1. Run `awty test` in a terminal (or `/awty test` in Claude Code). It ignores filters and mute, so it's the quickest way to test a channel.
2. Check `awty status` for the last error. Errors in `error.log` have the form `<channel>: <what went wrong>`. Common ones:

| Error | Meaning | Fix |
|---|---|---|
| `telegram: unresolved secret keychain:awty-telegram` | No Keychain item with that name, or its value is empty | Create it (see [Storing secrets](configuration.md#storing-secrets)) or fix the name in your config |
| `telegram: unresolved secret env:SOMETHING` | The variable isn't set (or is empty) where the tool runs | Start the tool with the variable set (see [Environment variables instead of Keychain](channels.md#using-environment-variables-instead-of-keychain)), or use `keychain:` on macOS |
| `telegram: HTTP 400 …` | The service's reply follows. `chat not found` means a wrong chat ID, or you never messaged the bot | Open the bot, tap **Start**, re-check the chat ID |
| `telegram: HTTP 401 …` | Token wrong or revoked (the reply says `Unauthorized`) | Get the token from @BotFather and update Keychain with `-U` |
| `telegram: missing chatId` (or any `<channel>: missing …`) | A required key is missing in the channel's block | See the channel's table in [Channels](channels.md) |
| `xyz: unknown channel xyz` | Typo in `channels` | Use one of: `telegram`, `ntfy`, `slack`, `discord`, `macos`, `pushover`, `bark`, `gotify`, `homeassistant`, `apprise` |
| `telegram: The operation was aborted due to timeout` | The service didn't answer within 8 seconds. The message is not retried. | Check your network and the server address |
| `apprise: not installed — run: uv tool install apprise` | Apprise isn't on the `PATH` | `uv tool install apprise` |
| `macos: spawn /usr/bin/osascript ENOENT` | The `macos` channel on Linux | Remove `macos` from `channels` |
| `config: cannot parse <file>: …` | A config file isn't valid JSON | Fix the file; check for trailing commas |
| `hook: node not found (looked on PATH and in common locations)` | The hook script couldn't find Node.js | See [How the hook finds Node](how-it-works.md#how-the-hook-finds-node) |

The part after `HTTP 400 ` or `HTTP 401 ` is the service's own reply, so the exact text depends on the service.

3. If a **test works but real messages don't**, a filter is suppressing them. Check:
   - **minDurationSec** (default 60): quick answers don't send Done. Try `/awty always=on`.
   - **onlyWhenAwaySec**: if set, nothing is sent while you're using your Mac (macOS only).
   - `/awty` shows `Notifications: OFF`: run `/awty on`.

## No macOS banner

Banners are shown through Script Editor. Open **System Settings → Notifications → Script Editor** and allow notifications. Also check that Focus / Do Not Disturb isn't on.

## Duplicate messages

- **Plugin loaded twice:** don't combine `claude --plugin-dir …` with an installed copy of the plugin.
- **Several channels pointing at the same app:** e.g. `telegram` plus `apprise` with a `tgram://` URL.

## Too many messages

- Raise the threshold: `/awty global min=300` only reports tasks longer than 5 minutes.
- Only notify when you're away: `/awty global away=120`.
- Mute a chatty session: `/awty off`.
- Turn off one kind: `/awty global waiting=off` or `done=off`.

## macOS asks "security wants to use your confidential information"

That's are-we-there-yet reading your token from Keychain. Click **Always Allow** so it doesn't ask again.

When you *add* a Keychain item, Terminal asks for the value (on some macOS versions twice). Paste it and press Enter each time; nothing is shown while you paste.

## Testing from a terminal

Simulate a "Done" event and print what would be sent, without sending anything:

```bash
echo "{\"session_id\":\"t\",\"cwd\":\"$PWD\",\"hook_event_name\":\"Stop\",\"last_assistant_message\":\"hi\"}" | AWTY_DRY_RUN=1 AWTY_SYNC=1 ~/are-we-there-yet/bin/run.sh
```

Send a real test message from Terminal. Replace `~/are-we-there-yet` with wherever are-we-there-yet is installed:

```bash
echo "{\"session_id\":\"t\",\"cwd\":\"$PWD\",\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"/awty test\"}" | AWTY_SYNC=1 ~/are-we-there-yet/bin/run.sh
```
