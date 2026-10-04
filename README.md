# are-we-there-yet

A Claude Code plugin that messages you when a session **is waiting for you** (an `AskUserQuestion` question, a permission prompt or an elicitation dialog) or **has finished a task**. Each message carries the session name and a short summary.

```
✅ [auth refactor] Done · 4m12s
JWT rotation is in place and all 42 tests pass.
📁 ~/code/api · 14:32
```

## Install

```bash
claude plugin marketplace add "/path/to/are-we-there-yet"
claude plugin install are-we-there-yet@are-we-there-yet-local
```

To try it without installing: `claude --plugin-dir /path/to/are-we-there-yet`. Requires Node.js ≥ 20.

## Configure

Layers, later wins: built-in defaults → `~/.config/are-we-there-yet/config.json` → `<project>/.claude/awty.json` → per-session `/awty` overrides.

```json
{
  "channels": ["telegram", "macos"],
  "events": { "done": true, "waiting": true },
  "filters": { "always": false, "minDurationSec": 60, "onlyWhenAwaySec": 0, "debounceSec": 0 },
  "summary": { "mode": "last-message", "maxChars": 300 },
  "telegram": { "botToken": "env:TELEGRAM_BOT_TOKEN", "chatId": "123456789" }
}
```

Defaults: `channels` is `["macos"]` (only macOS notifications are on until you configure another channel), both events on, `summary` is `last-message` with `maxChars` 300. Waiting alerts fire for `AskUserQuestion` questions and permission/elicitation prompts; finished turns are reported by the Done alert.

Secrets can be `env:VAR` or `keychain:<service>` (macOS: `security add-generic-password -s <service> -a "$USER" -w <token>`).

### Filters

| Key | Default | Effect |
|---|---|---|
| `filters.minDurationSec` | 60 | Only notify "done" if the turn took at least N seconds |
| `filters.onlyWhenAwaySec` | 0 (off) | Skip if you touched the keyboard/mouse in the last N seconds (macOS) |
| `filters.debounceSec` | 0 (off) | At most one "done" per session per N seconds |
| `filters.always` | false | Ignore the three filters above for "done" |

Scoping: `minDurationSec` and `debounceSec` apply to Done only (debounce counts only previous Done messages). `onlyWhenAwaySec` applies to both Done and waiting alerts. `always` bypasses the three filters for Done only. Waiting alerts always use the last-message summary.

### `/awty` in any session

```
/awty                       show effective settings and last error
/awty off | on              this session only
/awty channel=pushover,macos min=300 away=120
/awty done=off waiting=on   enable/disable each event (on|off)
/awty debounce=60 always=on at most one Done per 60 s; always=on bypasses filters for Done
/awty max=200               summary length in characters
/awty channels=telegram     alias of channel=
/awty summary=llm           one-line Haiku summary instead of Claude's last message
/awty name="auth refactor"  name used in messages
/awty reset                 drop this session's overrides
/awty test                  send a test message now
/awty global channel=telegram    write to global config
/awty project min=0              write to <project>/.claude/awty.json
```

## Channels

| Channel | Keys |
|---|---|
| `telegram` | `botToken`, `chatId` — create a bot with @BotFather, message it, get chat id from `https://api.telegram.org/bot<token>/getUpdates` |
| `ntfy` | `topic`, `server?` (default https://ntfy.sh), `token?`, `priority?`, `waitingPriority?` |
| `slack` | `webhookUrl` |
| `discord` | `webhookUrl` |
| `macos` | `sound?` (e.g. `Glass`) |
| `pushover` | `token`, `user`, `priority?`, `waitingPriority?` (2 = repeat until acknowledged) |
| `bark` | `key`, `server?`, `level?`, `waitingLevel?` (`timeSensitive` / `critical`) |
| `gotify` | `server`, `token`, `priority?`, `waitingPriority?` |
| `homeassistant` | `url`, `token`, `service` (e.g. `mobile_app_iphone`) |
| `apprise` | `config?` (path to apprise YAML), `urls?` — covers 170+ services (SMS, Signal, Matrix, email…). Install: `uv tool install apprise` |

## Troubleshooting

- `/awty` shows the last error; full log at `~/.config/are-we-there-yet/error.log`.
- Dry run a hook (prints what would be sent, touches nothing real):

  ```bash
  echo "{\"session_id\":\"t\",\"cwd\":\"$PWD\",\"hook_event_name\":\"Stop\",\"last_assistant_message\":\"hi\"}" | AWTY_HOME=$(mktemp -d) AWTY_SYNC=1 AWTY_DRY_RUN=1 bin/run.sh
  ```

- Run tests: `npm test`
