# Configuration

## Where settings live

Settings are merged from four layers; later layers win:

| Layer | Location | Set it with |
|---|---|---|
| 1. Built-in defaults | built in | — |
| 2. Global | `~/.config/are-we-there-yet/config.json` | editing the file, or `/awty global …` |
| 3. Project | `<project>/.claude/awty.json` | editing the file, or `/awty project …` |
| 4. Session | stored per session ID | `/awty …` |

- The project file `<project>/.claude/awty.json` applies to all tools, not just Claude Code. In a terminal, `awty set global|project …` does the same as `/awty global|project …`.
- Objects are merged key by key. Lists such as `channels` and plain values are replaced.
- For Claude Code, the project layer is read from the project root (`CLAUDE_PROJECT_DIR`), so it still applies after Claude `cd`s into a subfolder. For Codex and Antigravity it's read from the folder the agent is working in.
- Session settings disappear with the session; their files are cleaned up after 14 days.
- If a file isn't valid JSON, that layer is skipped and the error is logged. The other layers still apply.
- Files that awty creates are readable only by you. A `config.json` you create by hand keeps whatever permissions you gave it, so run `chmod 600 ~/.config/are-we-there-yet/config.json`, especially if it holds a literal token (better: use [`keychain:` or `env:`](#storing-secrets)).

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
| `channels` | `["macos"]` on macOS, none elsewhere | Where messages go. On Linux, set a channel first. See [Channels](channels.md). |
| `events.done` | `true` | Send "✅ Done" when a task finishes |
| `events.waiting` | `true` | Send "❓/⏳ Waiting for you" when the agent asks a question or needs permission, and "📣 Needs attention" when a Claude Code mod raises a notification |
| `events.paused` | `true` | Send "⏸ Paused" when Claude Code stops while background tasks are still running (Claude Code only; see [Paused](how-it-works.md#paused-background-jobs)) |
| `filters.minDurationSec` | `60` | Only send Done if the task took at least this many seconds |
| `filters.onlyWhenAwaySec` | `0` (off) | Only send if your Mac has had no keyboard or mouse input for this many seconds. macOS only: on Linux it is ignored and messages are sent. |
| `filters.debounceSec` | `0` (off) | At most one Done per session in this many seconds |
| `filters.always` | `false` | Send every Done, ignoring the three filters above |
| `summary.mode` | `last-message` | `last-message`: the agent's final reply, cleaned up. `llm`: a one-sentence summary written by Claude Haiku (see [Summaries](#summaries)). |
| `summary.maxChars` | `300` | Maximum summary length |
| `name` | none | Session name used in messages (normally set per session with `/awty name="…"`) |
| `<channel>` | — | Settings for each channel, e.g. `"telegram": {…}`. See [Channels](channels.md). |

### Choosing which messages you get

Each kind of message has its own switch. All three are on by default.

| Switch | Message | Tools |
|---|---|---|
| `done=on\|off` | ✅ Done | all |
| `waiting=on\|off` | ❓ and ⏳ Waiting for you, and 📣 Needs attention. Questions, permission requests and mod notifications share this one switch. | all |
| `paused=on\|off` | ⏸ Paused | Claude Code |

Set them for one session, one project, or everything:

```
/awty paused=off                 this session (Claude Code only)
awty set project done=off        the project in the current folder, from a terminal
awty set global waiting=off      every session, from a terminal
```

In Codex you can switch `done` and `waiting` for a session by typing `awty done=off` (no slash). `paused` has no effect there, because Paused is Claude Code only.

Common combinations:

- **Only when I'm needed:** `done=off paused=off`
- **Only when it's finished:** `waiting=off paused=off`
- **No early "paused" pings:** `paused=off`

`awty status` (or `/awty`) shows the current state on its `Events:` line.

### Which filters apply to which message

| | ✅ Done | ❓/⏳ Waiting |
|---|---|---|
| `enabled`, `events.*` | ✔ | ✔ |
| `minDurationSec` | ✔ | — |
| `debounceSec` (counts only previous Done messages) | ✔ | — |
| `onlyWhenAwaySec` | ✔ (skipped when `always` is on) | ✔ |
| `always` | bypasses the three above | — |

⏸ Paused follows the same rules as Done, except the debounce (it neither counts toward nor is blocked by `debounceSec`).

A ✅ Done for a finished background session (Claude Code's `agent_completed`) has no task of its own in this session, so `minDurationSec` and `debounceSec` don't apply to it and it doesn't count toward the debounce. `events.done`, `onlyWhenAwaySec` and `always` do.

Waiting messages are urgent by nature, so they ignore the duration and debounce filters. The rules for the ones that arrive close together:

- **Waiting de-duplication.** A "⏳ permission" alert is skipped only if a "❓ question" alert for the same session went out in the previous 2 minutes (the agent often raises both for one question). Two permission requests in a row both notify, and a 📣 mod notification is never skipped.
- **Done after a Waiting message.** If you were sent a Waiting message during the same task, its Done skips the minimum-duration filter only. You were probably away, so you'll want to know when it finished. Debounce and away-from-keyboard still apply.
- **Unknown start.** If awty doesn't know when the task started (the session began before you installed awty), Done is sent without a duration and the minimum-duration filter doesn't apply.

To see why a particular message was or wasn't sent, run `awty status` and read the `Recent:` lines. See [The decision log](how-it-works.md#the-decision-log).

### Summaries

- **`last-message`** (default) uses the agent's final message for Done, and the question text or permission request for Waiting. Line breaks, paragraphs and bullets are kept (bullets show as `•`). Markdown styling is removed, code blocks become `[code]`, and the summary is limited to 8 non-empty lines and `maxChars` characters, ending in `…` when cut.
- **`llm`** asks `claude -p --model haiku` for one sentence of up to 200 characters.
  - For Claude Code it's based on the end of the conversation; for Codex and Antigravity, on the agent's last message.
  - It needs the `claude` CLI installed, whichever tool the session runs in, and adds a few seconds and a small API cost per Done message.
  - If `claude` is missing, fails or takes more than 15 seconds, awty silently falls back to `last-message`.
  - Only Done uses it, and not the Done for a finished background session. Paused and Waiting messages (and test messages) always use `last-message`.

## Storing secrets

A setting value can point at a secret instead of containing it:

| Write | Reads from |
|---|---|
| `"keychain:awty-telegram"` | the macOS Keychain item with service name `awty-telegram` |
| `"env:TELEGRAM_BOT_TOKEN"` | the environment variable `TELEGRAM_BOT_TOKEN` |

Rules:

- `env:` and `keychain:` are resolved only for values inside a channel block (`"telegram": {…}`, `"slack": {…}` and so on). Elsewhere in the config they are taken as plain text.
- A secret is resolved only at the moment a message is sent and is never written to the log.
- An empty value counts as unresolved: the message fails with `<channel>: unresolved secret keychain:awty-telegram` in the error log.
- Keychain lookup is by service name (`-s`), whatever the account name is.
- `keychain:` works on macOS only. On Linux use `env:`; see [Environment variables as secrets](channels.md#using-environment-variables-instead-of-keychain).

**Keychain** (recommended on macOS):

```bash
security add-generic-password -s awty-telegram -a "$USER" -w
```

Terminal asks for the value (on some macOS versions twice). Paste it and press Enter each time; nothing is shown while you paste. To replace an existing value, add `-U`. To remove it:

```bash
security delete-generic-password -s awty-telegram
```

The first time are-we-there-yet reads an item, macOS may ask whether `security` may access it. Choose **Always Allow**.

**Environment variables** only work if the tool (Claude Code, Codex or Antigravity) was itself started with them set. The desktop app usually doesn't see variables from your shell profile, so prefer Keychain there.

## `/awty` command reference

```
/awty [global|project] [setting…] | reset | test
```

With no scope word, changes apply to **this session only**. `global` writes to `~/.config/are-we-there-yet/config.json`; `project` writes to `<project>/.claude/awty.json`. In a terminal, see [The `awty` terminal command](#the-awty-terminal-command).

| Write | Sets |
|---|---|
| `on` / `off` | `enabled` |
| `done=on\|off` | `events.done` |
| `waiting=on\|off` | `events.waiting` |
| `paused=on\|off` | `events.paused` |
| `channel=a,b` (or `channels=a,b`) | `channels` |
| `min=N` | `filters.minDurationSec` |
| `away=N` | `filters.onlyWhenAwaySec` |
| `debounce=N` | `filters.debounceSec` |
| `always=on\|off` | `filters.always` |
| `summary=llm\|last-message` | `summary.mode` |
| `max=N` | `summary.maxChars` |
| `name="…"` | session name |

The bare words are exactly `on` and `off`. The aliases `true`/`false`, `yes`/`no` and `1`/`0` work only as values (`done=yes`). You can combine several settings in one command:

```
/awty channel=telegram min=300 away=120
/awty global channel=telegram,macos
/awty project done=off
```

Actions:

| Command | Does |
|---|---|
| `/awty` or `/awty status` | Show the effective settings and the last error |
| `/awty test` | Send a test message to every enabled channel, ignoring filters and mute |
| `/awty reset` | Remove this session's overrides (session scope only) |

If anything in the command is invalid, nothing is changed and the reply lists what was wrong.

Channel settings such as tokens can't be set with `/awty`; edit the config file for those.

## The `awty` terminal command

`awty` is installed with the package and works in any terminal. It does the same jobs as `/awty`, plus installing hooks.

```
awty <install|uninstall|status|test|set|help> [arguments]
```

| Command | What it does |
|---|---|
| `awty install <claude\|codex\|agy> [--project]` | Add the notification hooks to a tool. See [Install details](tools.md#install-details). |
| `awty uninstall <claude\|codex\|agy> [--project]` | Remove them. See [Upgrading and uninstalling](tools.md#upgrading-and-uninstalling). |
| `awty status` | Show the effective settings (global plus the project in the current folder), the last error, the last 5 [decisions](how-it-works.md#the-decision-log) and which hooks are installed. |
| `awty test` | Send a test message to every channel, ignoring filters and mute. Prints `Sent: telegram, macos`; failures are printed as `Failed: <channel>: <error>`. |
| `awty set <global\|project> key=value …` | Change settings with the same keys as `/awty`. Quote values with spaces: `awty set global name="my app"`. |
| `awty help` | Print the usage text (also `awty` with no arguments, `--help` and `-h`). |

Notes:

- `--project` makes `install`/`uninstall` act on the current folder's `.codex/hooks.json` or `.agents/hooks.json` instead of your home folder. It isn't supported for `claude`. `awty set project …` always writes `<current folder>/.claude/awty.json`; run it from the project root.
- `awty set` needs `global` or `project`, because a terminal has no session to change. `awty set global off` mutes everything; `awty set global on` turns it back on. `reset` only applies to sessions.
- Terminal `awty status` doesn't show a session's own overrides; type `/awty` (Claude Code) or `awty status` (Codex) inside that session for those.
- `awty test` prints `No channels configured. Add one: see docs/channels.md` and fails when `channels` is empty (the default on Linux).

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | OK |
| `1` | `install`/`uninstall` failed (the reason is printed), `awty test` has no channels, at least one channel failed in `awty test`, or `awty set` hit a config file that isn't valid JSON |
| `2` | Usage error: unknown command, `awty set` without `global`/`project` or without a `key=value`, or an invalid setting |

**Three ways to change the same setting**

| Where you are | Type | Applies to |
|---|---|---|
| Claude Code session | `/awty global min=300` | all sessions, all tools |
| Codex session | `awty global min=300` (no slash) | all sessions, all tools |
| Any terminal | `awty set global min=300` | all sessions, all tools |

Leave out `global` (inside a session) for that session only, or use `project` for the current project. Antigravity has no in-session command, so use the terminal form.

## Environment variables

For debugging and development:

| Variable | Effect |
|---|---|
| `AWTY_HOME` | Use a different data folder instead of `~/.config/are-we-there-yet` |
| `AWTY_DRY_RUN=1` | Print what would be sent instead of sending |
| `AWTY_SYNC=1` | Send in the foreground instead of a background process |
| `AWTY_DISABLE=1` | Turn are-we-there-yet off completely for that process |
| `CODEX_HOME` | Where Codex keeps its files. awty uses it to find `hooks.json` and Codex's thread titles (default `~/.codex`). |
