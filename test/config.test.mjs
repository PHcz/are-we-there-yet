import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpHome } from './helpers.mjs';
import { writeJson } from '../lib/jsonfile.mjs';
import { globalConfigPath, projectConfigPath, errorLogPath } from '../lib/paths.mjs';
import { saveState } from '../lib/state.mjs';
import { DEFAULTS, deepMerge, loadConfig, resolveSecrets } from '../lib/config.mjs';
import { logError, readLastError } from '../lib/errorlog.mjs';

test('deepMerge merges objects, replaces arrays and scalars', () => {
  const out = deepMerge({ a: { x: 1, y: 2 }, l: [1, 2], s: 'a' }, { a: { y: 3 }, l: [9], s: 'b' });
  assert.deepEqual(out, { a: { x: 1, y: 3 }, l: [9], s: 'b' });
});

test('loadConfig applies defaults <- global <- project <- session', () => {
  const home = tmpHome();
  const cwd = fs.mkdtempSync(path.join(home, 'proj-'));
  writeJson(globalConfigPath(), { channels: ['telegram'], filters: { minDurationSec: 30 } });
  writeJson(projectConfigPath(cwd), { filters: { debounceSec: 10 } });
  saveState('s1', { override: { enabled: false, filters: { minDurationSec: 5 } } });
  const cfg = loadConfig({ cwd, sessionId: 's1' });
  assert.deepEqual(cfg.channels, ['telegram']);
  assert.equal(cfg.filters.minDurationSec, 5);
  assert.equal(cfg.filters.debounceSec, 10);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.summary.maxChars, DEFAULTS.summary.maxChars);
});

test('loadConfig skips malformed layer and logs', () => {
  const home = tmpHome();
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(globalConfigPath(), '{broken');
  const cfg = loadConfig({ cwd: home, sessionId: 's' });
  assert.deepEqual(cfg.channels, DEFAULTS.channels);
  assert.match(readLastError(), /config\.json/);
});

test('resolveSecrets handles env: and keychain: deeply', () => {
  const out = resolveSecrets(
    { a: 'env:TOK', b: { c: 'keychain:svc' }, d: 'plain', e: 3 },
    { env: { TOK: 't0k' }, keychain: (s) => (s === 'svc' ? 'k3y' : null) },
  );
  assert.deepEqual(out, { a: 't0k', b: { c: 'k3y' }, d: 'plain', e: 3 });
});

test('resolveSecrets throws on unresolved reference', () => {
  assert.throws(() => resolveSecrets({ a: 'env:MISSING' }, { env: {} }), /unresolved secret env:MISSING/);
});

test('resolveSecrets leaves literal empty strings alone', () => {
  assert.deepEqual(resolveSecrets({ a: '', b: 'x' }, { env: {} }), { a: '', b: 'x' });
});

test('logError caps file at 200 lines', () => {
  tmpHome();
  for (let i = 0; i < 205; i++) logError(`e${i}`);
  const lines = fs.readFileSync(errorLogPath(), 'utf8').trim().split('\n');
  assert.equal(lines.length, 200);
  assert.match(readLastError(), /e204$/);
});

test('loadConfig normalizes channels to an array', () => {
  tmpHome();
  writeJson(globalConfigPath(), { channels: 'telegram' });
  assert.deepEqual(loadConfig({}).channels, ['telegram']);
  writeJson(globalConfigPath(), { channels: 5 });
  assert.deepEqual(loadConfig({}).channels, []);
});
