# are-we-there-yet

**Get pinged on your phone when your AI coding agent needs you.** Works with **Claude Code**, **OpenAI Codex CLI** and **Google Antigravity CLI**.

It sends you a message when a session:

- **is waiting for you**: Claude asked a question, or needs permission to run something
- **has finished a task** and handed control back

Each message shows which session it's from and what happened, so you can walk away from long tasks and come back at the right moment.

```
✅ Done · 4m 12s
auth refactor · Codex

┃ JWT rotation is in place.
┃ • all 42 tests pass
┃ • updated README

api · 14:32
```

Telegram, Slack and Discord show this as a formatted card; push apps (ntfy, Pushover, macOS…) show the first line as the title and the rest as the body.

Works with **Telegram, ntfy, Pushover, Slack, Discord, Bark, Gotify, Home Assistant and macOS notifications**. Through [Apprise](https://github.com/caronc/apprise) it also reaches 170+ other services, including SMS, Signal, Matrix and email.

---

## Quick start

**1. Install** (needs Node.js 20 or newer). are-we-there-yet isn't on npm yet; install it straight from GitHub. The repository is private for now, so you need access to it:

```bash
npm install -g github:PHcz/are-we-there-yet
```

Or work from a clone, so local edits take effect immediately:

```bash
git clone https://github.com/PHcz/are-we-there-yet.git ~/are-we-there-yet
cd ~/are-we-there-yet && npm link
```

**2. Connect your tools** (any or all):

```bash
awty install claude    # Claude Code
awty install codex     # OpenAI Codex CLI — then approve the hooks in Codex
awty install agy       # Google Antigravity CLI
```

**3. Send a test message:** `awty test`

To update, run the install command again (or `git pull` in your clone), then re-run `awty install <tool>` for each tool. Before removing awty, run `awty uninstall <tool>` first. Details: [Upgrading and uninstalling](docs/tools.md#upgrading-and-uninstalling).

Out of the box only **macOS notifications** are on. To get messages on your phone, set up a channel. Telegram takes about five minutes: see [Telegram setup](docs/channels.md#telegram).

---

## The `/awty` command

Type `/awty` in any session to see or change settings. The plugin handles the command itself, so it never reaches Claude and costs no tokens.

| Command | What it does |
|---|---|
| `/awty` | Show current settings and the last error |
| `/awty test` | Send a test message to every channel |
| `/awty off` / `/awty on` | Mute or unmute this session |
| `/awty name="auth refactor"` | Name this session in messages |
| `/awty min=300` | Only report "Done" for tasks longer than 5 minutes |
| `/awty away=120` | Only notify if you've been away from the keyboard for 2+ minutes (macOS) |
| `/awty channel=telegram,macos` | Choose where messages go |
| `/awty summary=llm` | One-line AI summary instead of Claude's last message |
| `/awty reset` | Drop this session's overrides |
| `/awty global …` | Save settings for all sessions, e.g. `/awty global channel=telegram` |
| `/awty project …` | Save settings for this project only |

In Codex type `awty …` without the slash; in Antigravity, and anywhere else, use the same settings from a terminal: `awty status`, `awty set global min=300`.

Full list: [Configuration → `/awty` reference](docs/configuration.md#awty-command-reference).

---

## Documentation

| Guide | What's in it |
|---|---|
| [Supported tools](docs/tools.md) | What works in Claude Code, Codex CLI and Antigravity, and how to install each |
| [Channels](docs/channels.md) | Step-by-step setup for each service: Telegram, ntfy, Pushover, Slack, Discord, Bark, Gotify, Home Assistant, macOS, Apprise |
| [Configuration](docs/configuration.md) | Config files, every setting and its default, filters, secrets, the full `/awty` grammar |
| [How it works](docs/how-it-works.md) | Which Claude Code events trigger messages, how names and summaries are chosen, where data is stored |
| [Troubleshooting](docs/troubleshooting.md) | Nothing arrives, duplicate messages, errors and how to fix them |

---

## Development

```bash
npm test          # all tests, no dependencies to install
claude --plugin-dir .   # run Claude Code with your working copy of the plugin
```
