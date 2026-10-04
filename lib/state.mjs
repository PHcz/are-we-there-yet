import fs from 'node:fs';
import path from 'node:path';
import { sessionPath, sessionsDir } from './paths.mjs';
import { readJson, writeJson } from './jsonfile.mjs';

export function loadState(id) {
  try {
    const s = readJson(sessionPath(id));
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

export function saveState(id, state) {
  writeJson(sessionPath(id), state);
}

export function updateState(id, fn) {
  const current = loadState(id);
  const next = fn(current) ?? current;
  saveState(id, next);
  return next;
}

export function pruneOldSessions(maxAgeDays = 14, now = Date.now()) {
  let removed = 0;
  let files;
  try {
    files = fs.readdirSync(sessionsDir());
  } catch {
    return 0;
  }
  for (const f of files) {
    const p = path.join(sessionsDir(), f);
    try {
      if (now - fs.statSync(p).mtimeMs > maxAgeDays * 86400_000) {
        fs.unlinkSync(p);
        removed++;
      }
    } catch {}
  }
  return removed;
}
