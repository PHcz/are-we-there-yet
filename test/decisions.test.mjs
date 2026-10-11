import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpHome } from './helpers.mjs';
import { logDecision, readRecentDecisions } from '../lib/decisions.mjs';
import { decisionsLogPath } from '../lib/paths.mjs';

beforeEach(() => { tmpHome(); });

test('logDecision writes one formatted line', () => {
  logDecision({ tool: 'codex', session: 'my app', kind: 'done', outcome: 'skipped: too short (41s < 60s)' });
  const lines = readRecentDecisions();
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\d{4}-\d\d-\d\dT[\d:.]+Z codex done skipped: too short \(41s < 60s\) · my app$/);
});

test('keeps the last 100 lines, newest last, mode 0600', () => {
  for (let i = 0; i < 120; i++) logDecision({ tool: 't', session: `s${i}`, kind: 'done', outcome: 'sent' });
  const all = fs.readFileSync(decisionsLogPath(), 'utf8').split('\n').filter(Boolean);
  assert.equal(all.length, 100);
  assert.match(all.at(-1), /· s119$/);
  assert.match(readRecentDecisions(2)[0], /· s118$/);
  assert.equal(fs.statSync(decisionsLogPath()).mode & 0o777, 0o600);
});

test('never throws and reads empty when missing', () => {
  assert.deepEqual(readRecentDecisions(), []);
  process.env.AWTY_HOME = '/dev/null/nope';
  assert.doesNotThrow(() => logDecision({ tool: 't', session: 's', kind: 'done', outcome: 'sent' }));
});
