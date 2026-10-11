# Channels

A channel is a place messages go. Turn channels on with the `channels` list in your config, and put each channel's settings in a block named after it:

```json
{
  "channels": ["telegram", "macos"],
  "telegram": { "botToken": "keychain:awty-telegram", "chatId": "123456789" }
}
```

Your global config lives at `~/.config/are-we-there-yet/config.json`; create it if it doesn't exist. After editing, run `awty test` in a terminal (or `/awty test` in a Claude Code session, `awty test` in Codex). You don't need to restart anything, because the config is re-read on every event, for all tools.

**Keep tokens out of the file.** Any value can be written as `keychain:<name>` (read from the macOS Keychain) or `env:<VARIABLE>` (read from an environment variable) instead of the literal secret. See [Storing secrets](configuration.md#storing-secrets).

| Channel | Cost | Phone push | Best for | Tested live |
|---|---|---|---|---|
| [Telegram](#telegram) | Free | iOS + Android | Most people. Five-minute setup. | ✅ |
| [ntfy](#ntfy) | Free | iOS + Android | No account at all | ✅ |
| [Pushover](#pushover) | $5 one-time | iOS + Android | Most reliable. Can repeat until you acknowledge. | ✅ |
| [Slack](#slack) / [Discord](#discord) | Free | via their apps | You already live in Slack or Discord | ✅ both |
| [Bark](#bark) | Free | iOS only | Breaks through Focus modes | ✅ |
| [Gotify](#gotify) | Free (self-hosted) | Android only | Self-hosters | ✅ server |
| [Home Assistant](#home-assistant) | Free | via HA app | You already run Home Assistant | ✅ |
| [macOS](#macos) | Free | none | At your desk. On by default on macOS. | ✅ |
| [Apprise](#apprise) | Free | depends | Anything else: SMS, Signal, Matrix, email… | ✅ (via ntfy) |

**Tested live** means a real message was sent to the real service (October 2026): it was delivered and shown correctly on the phone (Gotify: stored by a real Gotify server; Apprise: delivered through Apprise to ntfy; Home Assistant: through the companion app). Every channel has been checked this way, and all of them are also covered by automated tests against a simulated server.

---

## Using environment variables instead of Keychain

On Linux there is no Keychain, so use `env:` for every secret. It also works on macOS. For example, with Slack:

1. Put the secret in a variable in your shell profile (`~/.bashrc`, `~/.zshrc`, …):

```bash
export AWTY_SLACK_WEBHOOK='https://hooks.slack.com/services/…'
```

2. Refer to it in the channel's block:

```json
{
  "channels": ["slack"],
  "slack": { "webhookUrl": "env:AWTY_SLACK_WEBHOOK" }
}
```

3. Open a new terminal, start the tool (`claude`, `codex` or `agy`) from it, and send a test.

**The tool must be started with the variable set.** The hooks run inside the tool and only see its environment. A tool launched from a desktop icon, a launcher or a service usually doesn't read your shell profile, and then the error log says `slack: unresolved secret env:AWTY_SLACK_WEBHOOK`. After changing the variable, restart the tool. Note that `awty test` runs in your terminal, so it can succeed even when the tool's own environment lacks the variable.

---

## Telegram

You need a **bot token**, which works as the bot's password, and your **chat ID**, which tells the bot whose chat to post into.

**1. Create a bot.** In Telegram, open a chat with **@BotFather** (blue checkmark) and send `/newbot`. Choose a display name, e.g. `Agent Pings`, and a username ending in `bot`, e.g. `jane_claude_bot`. BotFather replies with a token like `7712345678:AAHk3…`.

**2. Start the bot.** Open your new bot via `https://t.me/<bot_username>`, tap **Start**, and send `hi`. A bot can't message you until you've messaged it first.

**3. Save the token in Keychain.** Terminal asks for the value (on some macOS versions twice). Paste it and press Enter each time; nothing is shown while you paste. (On Linux, use [an environment variable](#using-environment-variables-instead-of-keychain) instead.)

```bash
security add-generic-password -s awty-telegram -a "$USER" -w
```

To check it was saved without printing the token, run this. It shows the bot's username:

```bash
curl -s "https://api.telegram.org/bot$(security find-generic-password -s awty-telegram -w)/getMe" | grep -o '"username":"[^"]*"'
```

**4. Find your chat ID:**

```bash
curl -s "https://api.telegram.org/bot$(security find-generic-password -s awty-telegram -w)/getUpdates" | grep -o '"chat":{"id":[0-9-]*'
```

The number after `"id":` is your chat ID. If nothing prints, you haven't messaged the bot yet; go back to step 2. You can also message **@userinfobot**, which replies with your ID.

**5. Configure:**

```json
{
  "channels": ["telegram", "macos"],
  "telegram": {
    "botToken": "keychain:awty-telegram",
    "chatId": "123456789"
  }
}
```

If your token ever leaks, send `/revoke` to @BotFather to get a new one, then update the Keychain entry with `-U`:

```bash
security add-generic-password -U -s awty-telegram -a "$USER" -w
```

| Key | Required | Notes |
|---|---|---|
| `botToken` | yes | From @BotFather |
| `chatId` | yes | Your numeric chat ID, as a string |
| `apiBase` | no | Alternative Bot API address (default `https://api.telegram.org`). For testing or a self-hosted Bot API server. |

---

## ntfy

[ntfy](https://ntfy.sh) needs no account. Anyone who knows the topic name can read it, so pick something hard to guess.

1. Install the ntfy app (App Store or Google Play) and subscribe to a topic, e.g. `claude-jane-x7k2p9`.
2. Configure:

```json
{
  "channels": ["ntfy"],
  "ntfy": { "topic": "claude-jane-x7k2p9" }
}
```

| Key | Default | Notes |
|---|---|---|
| `topic` | (required) | Your topic name |
| `server` | `https://ntfy.sh` | Your own server, if self-hosting |
| `token` | none | Access token for protected topics |
| `priority` | `3` | Priority for Done messages (1–5) |
| `waitingPriority` | `4` | Priority for Waiting messages (1–5) |

---

## Pushover

[Pushover](https://pushover.net) costs $4.99 once per platform after a 30-day trial. It's very reliable and has an emergency mode that keeps alerting until you acknowledge.

1. Sign up, install the app, and copy your **User Key** from the dashboard.
2. [Create an application](https://pushover.net/apps/build) and copy its **API Token**.
3. Store the token in Keychain:

```bash
security add-generic-password -s awty-pushover -a "$USER" -w
```

4. Configure:

```json
{
  "channels": ["pushover"],
  "pushover": { "token": "keychain:awty-pushover", "user": "your-user-key", "waitingPriority": 1 }
}
```

| Key | Default | Notes |
|---|---|---|
| `token` | (required) | Application API token |
| `user` | (required) | Your user key |
| `priority` | `0` | Priority for Done (-2 to 2) |
| `waitingPriority` | `0` | Priority for Waiting. `1` bypasses quiet hours. `2` repeats every minute for up to an hour until acknowledged. |
| `apiBase` | `https://api.pushover.net` | Alternative API address, for testing or self-hosting |

Whenever the priority used for a message is `2` (`priority` for Done, `waitingPriority` for Waiting), awty also sends Pushover's emergency settings: retry every 60 seconds, expire after 3600 seconds.

---

## Slack

1. Create a Slack app with an [incoming webhook](https://api.slack.com/messaging/webhooks) and pick a channel; a DM with yourself works.
2. Configure:

```json
{
  "channels": ["slack"],
  "slack": { "webhookUrl": "env:AWTY_SLACK_WEBHOOK" }
}
```

| Key | Notes |
|---|---|
| `webhookUrl` | The `https://hooks.slack.com/services/…` URL. It's a secret, so store it in Keychain or an env var. |

---

## Discord

1. In a channel's settings: **Integrations → Webhooks → New Webhook → Copy Webhook URL**.
2. Configure:

```json
{
  "channels": ["discord"],
  "discord": { "webhookUrl": "keychain:awty-discord" }
}
```

| Key | Notes |
|---|---|
| `webhookUrl` | The `https://discord.com/api/webhooks/…` URL. It's a secret. |

Messages can't ping anyone: `@everyone`, `@here` and user or role mentions in the text are not turned into mentions.

---

## Bark

[Bark](https://github.com/Finb/Bark) is a free, iOS-only app. Time-sensitive alerts get through Focus modes.

1. Install Bark from the App Store. It shows a URL like `https://api.day.app/AbCdEf123/`; the part after the domain is your key.
2. Configure:

```json
{
  "channels": ["bark"],
  "bark": { "key": "AbCdEf123" }
}
```

| Key | Default | Notes |
|---|---|---|
| `key` | (required) | Your device key |
| `server` | `https://api.day.app` | Your own Bark server, if self-hosting |
| `level` | `active` | Level for Done: `passive`, `active`, `timeSensitive` or `critical` |
| `waitingLevel` | `timeSensitive` | Level for Waiting. `critical` plays sound even when muted. |

Bark groups all messages under `awty`, so they collect in one thread in the app.

---

## Gotify

[Gotify](https://gotify.net) is self-hosted, with an Android client.

1. In your Gotify web UI, create an application and copy its token.
2. Configure:

```json
{
  "channels": ["gotify"],
  "gotify": { "server": "https://gotify.example.com", "token": "keychain:awty-gotify" }
}
```

| Key | Default | Notes |
|---|---|---|
| `server` | (required) | Your Gotify URL |
| `token` | (required) | Application token |
| `priority` | `5` | Priority for Done |
| `waitingPriority` | `8` | Priority for Waiting |

---

## Home Assistant

Uses the Home Assistant companion app's notify service.

1. In Home Assistant: **Profile → Security → Long-lived access tokens → Create token**.
2. Find your phone's notify service under **Developer tools → Actions**, e.g. `notify.mobile_app_janes_iphone`. Use the part after `notify.`.
3. Configure:

```json
{
  "channels": ["homeassistant"],
  "homeassistant": { "url": "http://homeassistant.local:8123", "token": "keychain:awty-ha", "service": "mobile_app_janes_iphone" }
}
```

| Key | Notes |
|---|---|
| `url` | Your Home Assistant URL |
| `token` | Long-lived access token |
| `service` | Notify service name, without the `notify.` prefix |

---

## macOS

On by default on macOS. Shows a native notification banner. It needs no setup, but it only helps when you're at your Mac.

```json
{ "macos": { "sound": "Glass" } }
```

| Key | Default | Notes |
|---|---|---|
| `sound` | none | Any name from `/System/Library/Sounds`, e.g. `Glass`, `Ping`, `Hero` |

Works on macOS only; on Linux remove `macos` from `channels`. If no banner appears, check **System Settings → Notifications → Script Editor** and allow notifications.

---

## Apprise

[Apprise](https://github.com/caronc/apprise) is a separate tool that speaks to 170+ services: SMS (Twilio and others), Signal, WhatsApp, Matrix, email, Microsoft Teams, Pushbullet, LINE and more. awty calls it when it's installed.

1. Install it:

```bash
uv tool install apprise
```

(`pipx install apprise` also works.)

2. Write the services you want as [Apprise URLs](https://github.com/caronc/apprise/wiki) in a config file, e.g. `~/.config/are-we-there-yet/apprise.yml`:

```yaml
urls:
  - mailto://user:app-password@gmail.com
  - signal://localhost:8080/+15551234567/+15557654321
```

3. Configure:

```json
{
  "channels": ["apprise"],
  "apprise": { "config": "/Users/jane/.config/are-we-there-yet/apprise.yml" }
}
```

| Key | Notes |
|---|---|
| `config` | Full path to an Apprise config file, e.g. `/Users/jane/.config/are-we-there-yet/apprise.yml` |
| `urls` | Alternatively, a list of Apprise URLs inline. Each may be `keychain:`/`env:`. |

If Apprise isn't installed, the error log says `apprise: not installed — run: uv tool install apprise`. If Apprise runs but fails, it says `apprise: exit <code>: <Apprise's message>`.
