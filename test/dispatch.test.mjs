import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as macos from '../channels/macos.mjs';
import * as apprise from '../channels/apprise.mjs';
import { CHANNELS } from '../channels/index.mjs';
import { dispatch } from '../lib/dispatch.mjs';

const msg = { title: 'T "q"', body: 'B\\x', text: 'T\nB', kind: 'done' };

test('macos builds osascript with escaped strings', async () => {
  let call;
  await macos.send(msg, { sound: 'Glass' }, { exec: async (f, a) => { call = [f, a]; return { stdout: '' }; } });
  assert.equal(call[0], 'osascript');
  assert.equal(call[1][1], 'display notification "B\\\\x" with title "T \\"q\\"" sound name "Glass"');
});

test('apprise passes title, body, config and urls; ENOENT gives install hint', async () => {
  let call;
  await apprise.send(msg, { config: '/c.yml', urls: ['tgram://x'] }, { exec: async (f, a) => { call = [f, a]; return { stdout: '' }; } });
  assert.deepEqual(call, ['apprise', ['-t', msg.title, '-b', msg.body, '--config', '/c.yml', 'tgram://x']]);
  const enoent = Object.assign(new Error('spawn apprise ENOENT'), { code: 'ENOENT' });
  await assert.rejects(apprise.send(msg, {}, { exec: async () => { throw enoent; } }), /uv tool install apprise/);
});

test('registry has all ten channels', () => {
  assert.deepEqual(Object.keys(CHANNELS).sort(), ['apprise', 'bark', 'discord', 'gotify', 'homeassistant', 'macos', 'ntfy', 'pushover', 'slack', 'telegram']);
});

test('dispatch with real resolver', async () => {
  process.env.AWTY_TOK = 'secret';
  const got = [];
  const errors = [];
  const channels = {
    a: { send: async (m, c) => got.push(c.token) },
    b: { send: async () => { throw new Error('b: boom'); } },
    c: { send: async () => got.push('c') },
  };
  const res = await dispatch(msg, { channels: ['a', 'b', 'zzz', 'c'], a: { token: 'env:AWTY_TOK' }, c: { token: 'env:AWTY_NOPE' } },
    { channels, log: (e) => errors.push(e) });
  assert.deepEqual(got, ['secret']);
  assert.deepEqual(res.sent, ['a']);
  assert.deepEqual(res.failed.map((f) => f.name).sort(), ['b', 'c', 'zzz']);
  assert.equal(errors.length, 3);
  assert.ok(errors.some((e) => /unknown channel zzz/.test(e)));
});

test('dispatch times out slow channels', async () => {
  const channels = { slow: { send: (m, c, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) } };
  const res = await dispatch(msg, { channels: ['slow'] }, { channels, timeoutMs: 50, log: () => {} });
  assert.deepEqual(res.failed.map((f) => f.name), ['slow']);
});

test('dispatch dry run prints instead of sending', async () => {
  const lines = [];
  const channels = { a: { send: async () => { throw new Error('should not send'); } } };
  const res = await dispatch(msg, { channels: ['a'] }, { channels, dryRun: true, out: (s) => lines.push(s) });
  assert.deepEqual(res.sent, ['a']);
  assert.deepEqual(JSON.parse(lines[0]), { channel: 'a', title: msg.title, body: msg.body });
});
