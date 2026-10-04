# Troubleshooting

Start with `/awty` in a Claude Code session. It shows your effective settings and the **last error**. The full log is at `~/.config/are-we-there-yet/error.log`:

```bash
tail -20 ~/.config/are-we-there-yet/error.log
```

## `/awty` gets an answer from Claude instead of a status reply

The plugin's hooks aren't running in this session.

- **Plugin not installed or disabled:** check `claude plugin list`; it should show `are-we-there-yet … ✔ enabled`.
- **Session started before you installed the plugin:** type `/reload-plugins` or start a new session.
- **Node.js not found:** the hook needs Node.js 20+ on your `PATH` or in `/opt/homebrew/bin`, `/usr/local/bin` or `~/.volta/bin`. Check with `node --version`.

## Nothing arrives

1. Run `/awty test`. It ignores filters and mute, so it's the quickest way to test a channel.
2. Check `/awty` for the last error. Common ones:

| Error | Meaning | Fix |
|---|---|---|
| `unresolved secret keychain:awty-telegram` | No Keychain item with that name | Create it (see [Storing secrets](configuration.md#storing-secrets)) or fix the name in your config |
| `unresolved secret env:SOMETHING` | The variable isn't set where Claude Code runs | Use `keychain:` instead, especially with the desktop app |
| `telegram: HTTP 400 … chat not found` | Wrong chat ID, or you never messaged the bot | Open the bot, tap **Start**, re-check the chat ID |
| `telegram: HTTP 401 Unauthorized` | Token wrong or revoked | Get the token from @BotFather and update Keychain with `-U` |
| `telegram: missing chatId` (or any `missing …`) | A required key is missing in the channel's block | See the channel's table in [Channels](channels.md) |
| `unknown channel xyz` | Typo in `channels` | Use one of: `telegram`, `ntfy`, `slack`, `discord`, `macos`, `pushover`, `bark`, `gotify`, `homeassistant`, `apprise` |
| `apprise: not installed` | Apprise isn't on the `PATH` | `uv tool install apprise` |
| `config: cannot parse …` | A config file isn't valid JSON | Fix the file; check for trailing commas |

3. If a **test works but real messages don't**, a filter is suppressing them. Check:
   - **minDurationSec** (default 60): quick answers don't send Done. Try `/awty always=on`.
   - **onlyWhenAwaySec**: if set, nothing is sent while you're using your Mac.
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

That's the plugin reading your token from Keychain. Click **Always Allow** so it doesn't ask again.

## Testing without Claude Code

Simulate a "Done" event and print what would be sent, without sending anything:

```bash
echo "{\"session_id\":\"t\",\"cwd\":\"$PWD\",\"hook_event_name\":\"Stop\",\"last_assistant_message\":\"hi\"}" | AWTY_DRY_RUN=1 AWTY_SYNC=1 ~/are-we-there-yet/bin/run.sh
```

Send a real test message from Terminal. Replace `~/are-we-there-yet` with wherever the plugin lives:

```bash
echo "{\"session_id\":\"t\",\"cwd\":\"$PWD\",\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"/awty test\"}" | AWTY_SYNC=1 ~/are-we-there-yet/bin/run.sh
```
