import { CHANNELS } from '../channels/index.mjs';
import { resolveSecrets } from './config.mjs';
import { logError } from './errorlog.mjs';

export async function dispatch(msg, cfg, {
  channels = CHANNELS,
  timeoutMs = 8000,
  log = logError,
  dryRun = process.env.CLAUDE_NOTIFY_DRY_RUN === '1',
  out = (s) => process.stdout.write(`${s}\n`),
  resolve = resolveSecrets,
} = {}) {
  const sent = [];
  const failed = [];
  await Promise.all((cfg.channels ?? []).map(async (name) => {
    try {
      const mod = channels[name];
      if (!mod) throw new Error(`unknown channel ${name}`);
      if (dryRun) {
        out(JSON.stringify({ channel: name, title: msg.title, body: msg.body }));
        sent.push(name);
        return;
      }
      const channelCfg = resolve(cfg[name] ?? {});
      await mod.send(msg, channelCfg, { signal: AbortSignal.timeout(timeoutMs) });
      sent.push(name);
    } catch (err) {
      failed.push({ name, error: err.message });
      log(`${name}: ${err.message}`);
    }
  }));
  return { sent, failed };
}
