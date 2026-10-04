---
description: Configure are-we-there-yet notifications (on/off, channels, filters, test)
argument-hint: "[global|project] [on|off] [channel=a,b] [min=N] [away=N] [debounce=N] [always=on|off] [summary=llm|last-message] [name=\"...\"] | reset | test"
---

The are-we-there-yet `UserPromptSubmit` hook normally intercepts `/awty` before it reaches you and replies to the user directly. If you are reading this, the hook did not run.

Tell the user, briefly:
1. The are-we-there-yet hook did not intercept the command, so nothing was changed.
2. Check the plugin is enabled (`/plugin` → are-we-there-yet) and that Node.js ≥ 20 is installed at one of: on PATH, `/opt/homebrew/bin/node`, `/usr/local/bin/node`.
3. Errors are logged in `~/.config/are-we-there-yet/error.log`.

Do not try to edit configuration files yourself for this command. Requested arguments were: $ARGUMENTS
