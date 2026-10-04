import fs from 'node:fs';
import path from 'node:path';
import { errorLogPath } from './paths.mjs';

const MAX_LINES = 200;

export function logError(msg) {
  try {
    const file = errorLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let lines = [];
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {}
    lines.push(`${new Date().toISOString()} ${String(msg).replace(/\s+/g, ' ')}`);
    fs.writeFileSync(file, lines.slice(-MAX_LINES).join('\n') + '\n', { mode: 0o600 });
  } catch {}
}

export function readLastError() {
  try {
    const lines = fs.readFileSync(errorLogPath(), 'utf8').split('\n').filter(Boolean);
    return lines.at(-1) ?? null;
  } catch {
    return null;
  }
}
