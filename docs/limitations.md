# Limitations and known issues

What are-we-there-yet can't do, or does differently from what you might expect.

## By tool

**Antigravity CLI**
- No Waiting message for command approvals ("Run this command?"). Antigravity runs its hook for every command and doesn't say when it's waiting for you, so only explicit questions (`ask_question`, `ask_permission`) send a Waiting message. See [Supported tools](tools.md#antigravity-cli).
- No in-session command. Use `awty status` and `awty set …` in a terminal.
- Antigravity has no per-session name. A name can be set per project (`awty set project name="…"`) or globally (`awty set global name="…"`).

**Codex CLI**
- No question alerts, because Codex has no question tool. You get ⏳ permission requests and Done.
- You type `awty …` without a slash, and any prompt whose first word is `awty` is treated as a command and never reaches the model. Start the prompt with something else if you mean it as a normal request.
- Codex only runs hooks you have approved. See [Troubleshooting](troubleshooting.md#codex-nothing-happens).

**Claude Code**
- The desktop app may show "/awty isn't a command here" when you type the command. It still works: the hook handles it before the message goes anywhere. Its full name is `/are-we-there-yet:awty`.
- The plugin is cached per version. After an update, refresh it with `awty uninstall claude && awty install claude`. See [Upgrading and uninstalling](tools.md#upgrading-and-uninstalling).

## Messages

- **Paused is Claude Code only**, and it can go stale: a background job that is killed without reporting back (for example when you close the session) never shows as finished, so a later Paused may list it. See [Paused](how-it-works.md#paused-background-jobs).
- **No retries.** A failed send is logged to `error.log` and dropped.
- **One summary per message,** at most 8 lines and 300 characters by default (`max=N` raises the character limit; the 8-line cap is fixed).
- **`summary=llm` needs the `claude` CLI** and falls back to the plain summary if it's missing or takes over 15 seconds.

## Platforms

- **macOS** is fully supported.
- **Linux** works except for the `macos` channel, `onlyWhenAwaySec` (ignored: messages are sent) and `keychain:` secrets (use `env:`). There is no default channel, so [set one](channels.md) first.
- **Windows** is not supported, because the hooks are shell scripts. WSL has not been tested.

## Reporting a problem

Run `awty status` and look at `Recent:` and `Last error`. Don't paste tokens or webhook URLs into an issue.
