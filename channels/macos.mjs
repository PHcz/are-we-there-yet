import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export async function send(msg, cfg = {}, { exec = promisify(execFile) } = {}) {
  let script = `display notification "${esc(msg.body)}" with title "${esc(msg.title)}"`;
  if (cfg.sound) script += ` sound name "${esc(cfg.sound)}"`;
  await exec('osascript', ['-e', script], { timeout: 5000 });
}
