import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export async function send(msg, cfg = {}, { exec = promisify(execFile), signal } = {}) {
  const args = ['-t', msg.title, '-b', msg.body];
  if (cfg.config) args.push('--config', cfg.config);
  if (Array.isArray(cfg.urls)) args.push(...cfg.urls);
  try {
    await exec('apprise', args, { timeout: 8000, signal });
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('apprise: not installed — run: uv tool install apprise');
    throw new Error(`apprise: ${err.message}`);
  }
}
