import fs from 'node:fs';
import path from 'node:path';
import { decisionsLogPath } from './paths.mjs';

const MAX_LINES = 100;

export function logDecision({ tool, session, kind, outcome }) {
  try {
    const file = decisionsLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let lines = [];
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {}
    const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
    lines.push(`${new Date().toISOString()} ${clean(tool)} ${clean(kind)} ${clean(outcome)} \u00b7 ${clean(session)}`);
    fs.writeFileSync(file, lines.slice(-MAX_LINES).join('\n') + '\n', { mode: 0o600 });
  } catch {}
}

export function readRecentDecisions(n = 5) {
  try {
    return fs.readFileSync(decisionsLogPath(), 'utf8').split('\n').filter(Boolean).slice(-n);
  } catch {
    return [];
  }
}
