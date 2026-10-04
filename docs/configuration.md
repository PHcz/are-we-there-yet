# Configuration

## Where settings live

Settings are merged from four layers; later layers win:

| Layer | Location | Set it with |
|---|---|---|
| 1. Built-in defaults | in the plugin | — |
| 2. Global | `~/.config/are-we-there-yet/config.json` | editing the file, or `/awty global …` |
| 3. Project | `<project>/.claude/awty.json` | editing the file, or `/awty project …` |
| 4. Session | stored per session ID | `/awty …` |

- The project file `<project>/.claude/awty.json` applies to all tools, not just Claude Code. In a terminal, `awty set global|project …` does the same as `/awty global|project …`.
- Objects are merged key by key. Lists such as `channels` and plain values are replaced.
- The project layer is read from the project root (`CLAUDE_PROJECT_DIR`), so it still applies after Claude `cd`s into a subfolder.
- Session settings disappear with the session; their files are cleaned up after 14 days.
- If a file isn't valid JSON, that layer is skipped and the error is logged. The other layers still apply.

You don't need to restart anything after changing settings: they are re-read on every event.

## Full example

```json
{
  "enabled": true,
  "channels": ["telegram", "macos"],
  "events": { "done": true, "waiting": true },
  "filters": {
    "minDurationSec": 60,
    "onlyWhenAwaySec": 0,
    "debounceSec": 0,
    "always": false
  },
  "summary": { "mode": "last-message", "maxChars": 300 },

  "telegram": { "botToken": "keychain:awty-telegram", "chatId": "123456789" },
  "macos": { "sound": "Glass" }
}
```

## Settings reference

| Setting | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch |
| `channels` | `["macos"]` | Where messages go. See [Channels](channels.md). |
| `events.done` | `true` | Send "✅ Done" when a task finishes |
| `events.waiting` | `true` | Send "❓/⏳ Waiting for you" when Claude asks a question or needs permission |
| `filters.minDurationSec` | `60` | Only send Done if the task took at least this many seconds |
| `filters.onlyWhenAwaySec` | `0` (off) | Only send if your Mac has had no keyboard or mouse input for this many seconds |
| `filters.debounceSec` | `0` (off) | At most one Done per session in this many seconds |
| `filters.always` | `false` | Send every Done, ignoring the three filters above |
| `summary.mode` | `last-message` | `last-message`: Claude's final reply, cleaned up. `llm`: a one-sentence summary written by Claude Haiku. |
| `summary.maxChars` | `300` | Maximum summary length |
| `name` | none | Session name used in messages (normally set per session with `/awty name="…"`) |
| `<channel>` | — | Settings for each channel, e.g. `"telegram": {…}`. See [Channels](channels.md). |

### Which filters apply to which message

| | ✅ Done | ❓/⏳ Waiting |
|---|---|---|
| `enabled`, `events.*` | ✔ | ✔ |
| `minDurationSec` | ✔ | — |
| `debounceSec` (counts only previous Done messages) | ✔ | — |
| `onlyWhenAwaySec` | ✔ (skipped when `always` is on) | ✔ |
| `always` | bypasses the three above | — |

Waiting messages are urgent by nature, so they ignore the duration and debounce filters. If a "⏳ permission" alert would arrive within 2 minutes of a "❓ question" alert for the same session, it's dropped as a duplicate.

### Summaries

- **`last-message`** (default) uses Claude's final message for Done, and the question text or permission request for Waiting. Markdown is stripped, code blocks become `[code]`, and the text is cut to `maxChars` at a word boundary.
- **`llm`** asks `claude -p --model haiku` for one sentence based on the end of the conversation. It adds a few seconds and a small API cost per Done message. If it fails or takes more than 15 seconds, the plugin falls back to `last-message`. Waiting messages always use `last-message`.

## Storing secrets

Any setting value can point at a secret instead of containing it:

| Write | Reads from |
|---|---|
| `"keychain:awty-telegram"` | the macOS Keychain item with service name `awty-telegram` |
| `"env:TELEGRAM_BOT_TOKEN"` | the environment variable `TELEGRAM_BOT_TOKEN` |

Secrets are resolved only at the moment a message is sent and never written to the log.

**Keychain** (recommended on macOS):

```bash
security add-generic-password -s awty-telegram -a "$USER" -w
```

Terminal asks for the value twice. To replace an existing value, add `-U`. To remove it:

```bash
security delete-generic-password -s awty-telegram
```

The first time the plugin reads an item, macOS may ask whether `security` may access it. Choose **Always Allow**.

**Environment variables** only work if Claude Code itself was started with them set. The desktop app usually doesn't see variables from your shell profile, so prefer Keychain there.

## `/awty` command reference

```
/awty [global|project] [setting…] | reset | test
```

With no scope word, changes apply to **this session only**. `global` writes to `~/.config/are-we-there-yet/config.json`; `project` writes to `<project>/.claude/awty.json`.

| Write | Sets |
|---|---|
| `on` / `off` | `enabled` |
| `done=on\|off` | `events.done` |
| `waiting=on\|off` | `events.waiting` |
| `channel=a,b` (or `channels=a,b`) | `channels` |
| `min=N` | `filters.minDurationSec` |
| `away=N` | `filters.onlyWhenAwaySec` |
| `debounce=N` | `filters.debounceSec` |
| `always=on\|off` | `filters.always` |
| `summary=llm\|last-message` | `summary.mode` |
| `max=N` | `summary.maxChars` |
| `name="…"` | session name |

`on`/`off` also accept `true`/`false`, `yes`/`no` and `1`/`0`. You can combine several settings in one command:

```
/awty channel=telegram min=300 away=120
/awty global channel=telegram,macos
/awty project done=off
```

Actions:

| Command | Does |
|---|---|
| `/awty` | Show the effective settings and the last error |
| `/awty test` | Send a test message to every enabled channel, ignoring filters and mute |
| `/awty reset` | Remove this session's overrides (session scope only) |

If anything in the command is invalid, nothing is changed and the reply lists what was wrong.

Channel settings such as tokens can't be set with `/awty`; edit the config file for those.

## Environment variables

For debugging and development:

| Variable | Effect |
|---|---|
| `AWTY_HOME` | Use a different data folder instead of `~/.config/are-we-there-yet` |
| `AWTY_DRY_RUN=1` | Print what would be sent instead of sending |
| `AWTY_SYNC=1` | Send in the foreground instead of a background process |
| `AWTY_DISABLE=1` | Turn the plugin off completely for that process |
