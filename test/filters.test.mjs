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

test('notification waiting deduped against recent question alert', () => {
  const state = { lastWaitingSentAt: NOW - 30_000 };
  assert.equal(shouldNotify({ kind: 'waiting', source: 'notification', cfg: cfg(), state, now: NOW, idleSec: null }).ok, false);
  assert.equal(shouldNotify({ kind: 'waiting', source: 'question', cfg: cfg(), state, now: NOW, idleSec: null }).ok, true);
  assert.equal(shouldNotify({ kind: 'waiting', source: 'notification', cfg: cfg(), state: { lastWaitingSentAt: NOW - 130_000 }, now: NOW, idleSec: null }).ok, true);
});

test('getIdleSeconds parses ioreg and degrades', () => {
  assert.equal(getIdleSeconds({ platform: 'darwin', run: () => '    | |   "HIDIdleTime" = 138325421083\n' }), 138);
  assert.equal(getIdleSeconds({ platform: 'linux', run: () => 'x' }), null);
  assert.equal(getIdleSeconds({ platform: 'darwin', run: () => { throw new Error('no'); } }), null);
});
