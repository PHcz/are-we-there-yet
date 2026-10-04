import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpHome } from './helpers.mjs';
import { sessionPath } from '../lib/paths.mjs';
import { readJson, writeJson } from '../lib/jsonfile.mjs';
import { loadState, saveState, updateState, pruneOldSessions } from '../lib/state.mjs';

test('readJson returns undefined for missing file and throws on malformed', () => {
  const home = tmpHome();
  assert.equal(readJson(`${home}/nope.json`), undefined);
  fs.writeFileSync(`${home}/bad.json`, '{nope');
  assert.throws(() => readJson(`${home}/bad.json`));
});

test('writeJson creates parent dirs and round-trips', () => {
  const home = tmpHome();
  writeJson(`${home}/a/b/c.json`, { x: 1 });
  assert.deepEqual(readJson(`${home}/a/b/c.json`), { x: 1 });
  assert.equal(fs.statSync(`${home}/a/b/c.json`).mode & 0o777, 0o600);
});

test('loadState is empty for unknown or malformed session', () => {
  tmpHome();
  assert.deepEqual(loadState('s1'), {});
  fs.mkdirSync(sessionPath('s1').replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(sessionPath('s1'), 'garbage');
  assert.deepEqual(loadState('s1'), {});
});

test('updateState merges via callback and persists', () => {
  tmpHome();
  saveState('s2', { a: 1 });
  const out = updateState('s2', (s) => ({ ...s, b: 2 }));
  assert.deepEqual(out, { a: 1, b: 2 });
  assert.deepEqual(loadState('s2'), { a: 1, b: 2 });
});

test('sessionPath sanitizes ids', () => {
  tmpHome();
  assert.match(sessionPath('../../etc/passwd'), /sessions\/______etc_passwd\.json$/);
});

test('pruneOldSessions deletes files older than maxAgeDays', () => {
  tmpHome();
  saveState('old', {});
  saveState('new', {});
  const old = new Date(Date.now() - 20 * 86400_000);
  fs.utimesSync(sessionPath('old'), old, old);
  assert.equal(pruneOldSessions(14), 1);
  assert.equal(fs.existsSync(sessionPath('old')), false);
  assert.equal(fs.existsSync(sessionPath('new')), true);
});
