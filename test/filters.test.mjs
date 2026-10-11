import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, deepMerge } from '../lib/config.mjs';
import { shouldNotify, getIdleSeconds } from '../lib/filters.mjs';

const cfg = (patch = {}) => deepMerge(structuredClone(DEFAULTS), patch);
const NOW = 1_000_000_000;

test('disabled or event off blocks', () => {
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: cfg({ enabled: false }), state: {}, now: NOW, idleSec: null }).ok, false);
  assert.equal(shouldNotify({ kind: 'waiting', source: 'question', cfg: cfg({ events: { waiting: false } }), state: {}, now: NOW, idleSec: null }).ok, false);
});

test('minDuration applies to done only', () => {
  const state = { turnStartedAt: NOW - 30_000 };
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: cfg(), state, now: NOW, idleSec: null }).ok, false);
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: cfg(), state: { turnStartedAt: NOW - 61_000 }, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: cfg(), state: {}, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'waiting', source: 'question', cfg: cfg(), state, now: NOW, idleSec: null }).ok, true);
});

test('debounce', () => {
  const c = cfg({ filters: { minDurationSec: 0, debounceSec: 60 } });
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: { lastDoneSentAt: NOW - 10_000 }, now: NOW, idleSec: null }).ok, false);
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: { lastDoneSentAt: NOW - 70_000 }, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: { lastSentAt: NOW - 1_000, lastWaitingSentAt: NOW - 1_000 }, now: NOW, idleSec: null }).ok, true);
});

test('onlyWhenAway applies to both kinds; null idle passes', () => {
  const c = cfg({ filters: { minDurationSec: 0, onlyWhenAwaySec: 120 } });
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: {}, now: NOW, idleSec: 5 }).ok, false);
  assert.equal(shouldNotify({ kind: 'waiting', source: 'question', cfg: c, state: {}, now: NOW, idleSec: 5 }).ok, false);
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: {}, now: NOW, idleSec: 300 }).ok, true);
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: {}, now: NOW, idleSec: null }).ok, true);
});

test('always bypasses duration, debounce and away for done', () => {
  const c = cfg({ filters: { always: true, minDurationSec: 999, debounceSec: 999, onlyWhenAwaySec: 999 } });
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: c, state: { turnStartedAt: NOW, lastDoneSentAt: NOW }, now: NOW, idleSec: 0 }).ok, true);
});

test('notification waiting deduped against recent question alert only', () => {
  const state = { lastWaitingSentAt: NOW - 30_000, lastQuestionSentAt: NOW - 30_000 };
  const r = shouldNotify({ kind: 'waiting', source: 'notification', cfg: cfg(), state, now: NOW, idleSec: null });
  assert.deepEqual(r, { ok: false, reason: 'duplicate of a question alert' });
  assert.equal(shouldNotify({ kind: 'waiting', source: 'question', cfg: cfg(), state, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'waiting', source: 'notification', cfg: cfg(), state: { lastQuestionSentAt: NOW - 130_000 }, now: NOW, idleSec: null }).ok, true);
  // a recent permission alert does not suppress another permission alert
  assert.equal(shouldNotify({ kind: 'waiting', source: 'notification', cfg: cfg(), state: { lastWaitingSentAt: NOW - 30_000 }, now: NOW, idleSec: null }).ok, true);
});

test('skip reasons are specific and readable', () => {
  const r = (kind, c, state = {}, idleSec = null, source = 'stop') => shouldNotify({ kind, source, cfg: c, state, now: NOW, idleSec }).reason;
  assert.equal(r('done', cfg({ enabled: false })), 'notifications off');
  assert.equal(r('done', cfg({ events: { done: false } })), 'done messages off');
  assert.equal(r('waiting', cfg({ events: { waiting: false } })), 'waiting messages off');
  assert.equal(r('paused', cfg({ events: { paused: false } })), 'paused messages off');
  assert.equal(r('done', cfg(), { turnStartedAt: NOW - 41_000 }), 'too short (41s < 60s)');
  assert.equal(r('done', cfg({ filters: { minDurationSec: 0, debounceSec: 60 } }), { lastDoneSentAt: NOW - 20_000 }), 'debounced (last Done 20s ago, limit 60s)');
  assert.equal(r('done', cfg({ filters: { minDurationSec: 0, onlyWhenAwaySec: 120 } }), {}, 12), 'you were active (idle 12s < 120s)');
  // seconds are floored, so a skip never reads "60s < 60s"
  assert.equal(r('done', cfg(), { turnStartedAt: NOW - 59_600 }), 'too short (59s < 60s)');
  assert.equal(r('done', cfg({ filters: { minDurationSec: 0, debounceSec: 60 } }), { lastDoneSentAt: NOW - 59_600 }), 'debounced (last Done 59s ago, limit 60s)');
  assert.equal(r('done', cfg({ filters: { minDurationSec: 0, onlyWhenAwaySec: 120 } }), {}, 119.6), 'you were active (idle 119s < 120s)');
});

test('getIdleSeconds parses ioreg and degrades', () => {
  assert.equal(getIdleSeconds({ platform: 'darwin', run: () => '    | |   "HIDIdleTime" = 138325421083\n' }), 138);
  assert.equal(getIdleSeconds({ platform: 'linux', run: () => 'x' }), null);
  assert.equal(getIdleSeconds({ platform: 'darwin', run: () => { throw new Error('no'); } }), null);
});

test('a waiting alert during the turn lets the short Done through', () => {
  const state = { turnStartedAt: NOW - 30_000, lastWaitingSentAt: NOW - 20_000 };
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: cfg(), state, now: NOW, idleSec: null }).ok, true);
  const earlier = { turnStartedAt: NOW - 30_000, lastWaitingSentAt: NOW - 90_000 };
  assert.equal(shouldNotify({ kind: 'done', source: 'stop', cfg: cfg(), state: earlier, now: NOW, idleSec: null }).ok, false);
});

test('paused obeys events.paused and min duration but not debounce', () => {
  assert.equal(shouldNotify({ kind: 'paused', source: 'stop', cfg: cfg(), state: { turnStartedAt: NOW - 30_000 }, now: NOW, idleSec: null }).ok, false);
  assert.equal(shouldNotify({ kind: 'paused', source: 'stop', cfg: cfg({ filters: { always: true } }), state: { turnStartedAt: NOW - 30_000 }, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'paused', source: 'stop', cfg: cfg({ filters: { minDurationSec: 0, debounceSec: 600 } }), state: { lastDoneSentAt: NOW - 1000 }, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'paused', source: 'stop', cfg: cfg({ events: { paused: false } }), state: {}, now: NOW, idleSec: null }).ok, false);
});
