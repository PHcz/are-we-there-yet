# are-we-there-yet

**Get pinged on your phone when your AI coding agent needs you.** Works with **Claude Code**, **OpenAI Codex CLI** and **Google Antigravity CLI**.

It sends you a message when a session:

- **is waiting for you**: the agent asked a question, or needs permission to run something
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

Telegram, Slack and Discord show this as a formatted card; push apps (ntfy, Pushover, macOS…) get a one-line title (status, duration, session) with the summary as the body.

Works with **Telegram, ntfy, Pushover, Slack, Discord, Bark, Gotify, Home Assistant and macOS notifications**. Through [Apprise](https://github.com/caronc/apprise) it also reaches 170+ other services, including SMS, Signal, Matrix and email.

**Platforms:** macOS (full support) and Linux (no `macos` channel, no away-from-keyboard filter, no Keychain). Windows isn't supported. See [Limitations](docs/limitations.md).

---

## Quick start

**1. Install** (needs Node.js 20 or newer):

```bash
npm install -g @phcz/are-we-there-yet
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

Out of the box only **macOS notifications** are on. To get messages on your phone, set up a channel. Telegram takes about five minutes: see [Telegram setup](docs/channels.md#telegram). On Linux no channel is set by default, so choose one first; `awty test` tells you if none is configured.

By default a Done message is sent only for tasks that took **60 seconds or more**, so quick tasks stay quiet. Change that with `min=` (see below).

To update, run the install command again (or `git pull` in your clone), then re-run `awty install <tool>` for each tool. Before removing awty, run `awty uninstall <tool>` first. Details: [Upgrading and uninstalling](docs/tools.md#upgrading-and-uninstalling).

---

## The `/awty` command

You change settings from inside a session or from a terminal. In **Claude Code** type `/awty …`; in **Codex** type `awty …` (no slash, because Codex rejects unknown slash commands); **Antigravity** has no in-session command, so use the terminal. are-we-there-yet handles the command itself, so it never reaches the model and costs no tokens.

| Action | Claude Code | Codex | Terminal |
|---|---|---|---|
| Show settings (and last error) | `/awty` | `awty status` | `awty status` (also shows recent decisions and installed hooks) |
| Send a test message | `/awty test` | `awty test` | `awty test` |
| Mute / unmute this session | `/awty off` / `/awty on` | `awty off` / `awty on` | — (use `awty set global off`) |
| Name this session | `/awty name="auth refactor"` | `awty name="auth refactor"` | — |
| Choose which kinds of message | `/awty done=off` · `waiting=off` · `paused=off` | `awty done=off` · `waiting=off` | `awty set global done=off` |
| Only report Done after 5+ minutes | `/awty min=300` | `awty min=300` | `awty set global min=300` |
| Only notify if you've been away 2+ minutes (macOS) | `/awty away=120` | `awty away=120` | `awty set global away=120` |
| Choose where messages go | `/awty channel=telegram,macos` | `awty channel=telegram,macos` | `awty set global channel=telegram,macos` |
| One-line AI summary | `/awty summary=llm` | `awty summary=llm` | `awty set global summary=llm` |
| Drop this session's overrides | `/awty reset` | `awty reset` | — |
| Save for all sessions | `/awty global …` | `awty global …` | `awty set global …` |
| Save for this project only | `/awty project …` | `awty project …` | `awty set project …` (run in the project folder) |

Without `global` or `project`, a change applies to the current session only. For what each setting means, see [Choosing which messages you get](docs/configuration.md#choosing-which-messages-you-get). Full reference: [Configuration → `/awty` reference](docs/configuration.md#awty-command-reference) and [The `awty` terminal command](docs/configuration.md#the-awty-terminal-command).

---

## Privacy

Messages go only to the channels you set up. A message can contain the session name (which may include the first words of your first prompt), the agent's last reply, question and option text, the command or description needing permission, names of background jobs, the project folder name and the time. Tokens and webhook URLs belong in the macOS Keychain (`keychain:name`) or an environment variable (`env:NAME`), not in your config file. awty also keeps small state files and logs in `~/.config/are-we-there-yet/`; the decision log never contains message text. Details: [How it works → Privacy](docs/how-it-works.md#privacy).

---

## Documentation

| Guide | What's in it |
|---|---|
| [Supported tools](docs/tools.md) | What works in Claude Code, Codex CLI and Antigravity, tested versions, install details, uninstalling and removing everything |
| [Channels](docs/channels.md) | Step-by-step setup for each service: Telegram, ntfy, Pushover, Slack, Discord, Bark, Gotify, Home Assistant, macOS, Apprise |
| [Configuration](docs/configuration.md) | Config files, every setting and its default, filters, secrets, the full `/awty` grammar, the `awty` terminal command |
| [How it works](docs/how-it-works.md) | Which events trigger messages in each tool, how names and summaries are chosen, the decision log, privacy, where data is stored |
| [Troubleshooting](docs/troubleshooting.md) | [Why didn't I get a message?](docs/troubleshooting.md#why-didnt-i-get-a-message), duplicate messages, errors and how to fix them |
| [Limitations](docs/limitations.md) | What doesn't work, per tool and platform |
| [Changelog](CHANGELOG.md) | What changed in each version |

---

## Development

```bash
npm test          # all tests, no dependencies to install
claude --plugin-dir .   # run Claude Code with your working copy of the plugin
```

---

## Licence

MIT. See [LICENSE](LICENSE).
