# Changelog

All notable changes to are-we-there-yet. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-10-11

### Added
- Support for **OpenAI Codex CLI** and **Google Antigravity CLI**, next to Claude Code. All three share the same filters, summaries and channels.
- The `awty` terminal command: `install`, `uninstall`, `status`, `test`, `set` and `help`. The installer adds hooks to Codex (`hooks.json`) and Antigravity (`~/.gemini/config/hooks.json`) and installs the Claude Code plugin.
- Card layout for messages: formatted cards on Telegram, Slack and Discord; a one-line title plus body on push channels. Telegram falls back to plain text if formatting is rejected.
- Multi-line summaries that keep line breaks and bullets (at most 8 lines).
- ⏸ **Paused** message when Claude Code stops while background jobs are still running.
- Per-message switches: `done=`, `waiting=` and `paused=`.
- Decision log: `awty status` shows the last 5 decisions (`Recent:`) and why each message was sent or skipped. Stored in `decisions.log` without message text.
- Documented Linux gaps: no `macos` channel, no `onlyWhenAwaySec`, no `keychain:` secrets.
- Documentation: install details, removing everything, a "Why didn't I get a message?" checklist, a limitations page and a Privacy section.

### Changed
- The default channel is `macos` on macOS only and none elsewhere, so awty no longer tries `macos` on Linux.
- Waiting de-duplication is narrower: a ⏳ permission alert is skipped only when a ❓ question alert for the same session went out in the previous 2 minutes.
- A Done after a Waiting message in the same task skips only the minimum-duration filter; debounce and away-from-keyboard still apply.
- Errors in `error.log` carry a single channel prefix (for example `telegram: missing chatId`).
- `bin/run.sh` looks for Node in more places (including asdf, fnm and the highest nvm major version) and logs `hook: node not found …` when it finds none.
- `awty uninstall claude` also removes the local plugin marketplace.

### Fixed
- The stored first prompt is cut to 200 characters for every tool, including Antigravity.
- `awty test` no longer repeats the channel name in failure lines, and `awty set` exits with code 1 when a config file isn't valid JSON.
- `awty uninstall` with no tool names the right command in its message.
- Background-job and subagent wake-ups no longer reset the start of a task, so the final Done keeps its full duration and isn't dropped as too short.
- Discord messages can no longer ping `@everyone` or other mentions.
- Bark messages are grouped under `awty`.
- The installer keeps symlinked hooks files, writes atomically and refuses to touch files it can't parse.
- `awty status` marks hooks with an out-of-date path as stale and prints a clear message when the `claude` CLI can't be run.

## [0.1.0] - 2026-10-04

### Added
- Initial Claude Code plugin that sends a notification when a session is waiting for you or has finished a task.
- Ten channels: Telegram, ntfy, Pushover, Slack, Discord, Bark, Gotify, Home Assistant, macOS and Apprise.
- The `/awty` command (then `/notify`) to change settings from inside a session without using tokens.
- Layered settings (built-in, global, project, session), filters for task length, idle time and repeated messages, and secrets from the macOS Keychain or environment variables.
