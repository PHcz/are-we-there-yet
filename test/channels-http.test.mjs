import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as telegram from '../channels/telegram.mjs';
import * as ntfy from '../channels/ntfy.mjs';
import * as slack from '../channels/slack.mjs';
import * as discord from '../channels/discord.mjs';
import * as pushover from '../channels/pushover.mjs';
import * as bark from '../channels/bark.mjs';
import * as gotify from '../channels/gotify.mjs';
import * as homeassistant from '../channels/homeassistant.mjs';

let server, base, last, status = 200;
before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      last = { method: req.method, url: req.url, headers: req.headers, body };
      res.writeHead(status).end('ok');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const done = { title: '✅ [s] Done · 1m00s', body: 'All good\n📁 ~/x · 10:00', text: '✅ [s] Done · 1m00s\nAll good\n📁 ~/x · 10:00', kind: 'done' };
const waiting = { ...done, title: '❓ [s] Waiting for you', kind: 'waiting' };
const json = () => JSON.parse(last.body);

test('telegram', async () => {
  await telegram.send(done, { apiBase: base, botToken: 'T', chatId: '42' });
  assert.equal(last.url, '/botT/sendMessage');
  assert.deepEqual(json(), { chat_id: '42', text: done.text, disable_web_page_preview: true });
});

test('ntfy posts JSON to server root with priority by kind', async () => {
  await ntfy.send(waiting, { server: base, topic: 'tp', token: 'tk' });
  assert.equal(last.url, '/');
  assert.equal(last.headers.authorization, 'Bearer tk');
  assert.deepEqual(json(), { topic: 'tp', title: waiting.title, message: waiting.body, priority: 4 });
  await ntfy.send(done, { server: base, topic: 'tp' });
  assert.equal(json().priority, 3);
});

test('slack and discord', async () => {
  await slack.send(done, { webhookUrl: `${base}/slack` });
  assert.deepEqual(json(), { text: done.text });
  await discord.send(done, { webhookUrl: `${base}/discord` });
  assert.deepEqual(json(), { content: done.text });
});

test('pushover form with emergency priority for waiting', async () => {
  await pushover.send(waiting, { apiBase: base, token: 'A', user: 'U', waitingPriority: 2 });
  assert.equal(last.url, '/1/messages.json');
  const f = new URLSearchParams(last.body);
  assert.equal(f.get('token'), 'A');
  assert.equal(f.get('priority'), '2');
  assert.equal(f.get('retry'), '60');
  assert.equal(f.get('expire'), '3600');
  await pushover.send(done, { apiBase: base, token: 'A', user: 'U' });
  assert.equal(new URLSearchParams(last.body).get('priority'), '0');
});

test('bark', async () => {
  await bark.send(waiting, { server: base, key: 'K' });
  assert.equal(last.url, '/push');
  assert.deepEqual(json(), { device_key: 'K', title: waiting.title, body: waiting.body, level: 'timeSensitive', group: 'claude' });
});

test('gotify', async () => {
  await gotify.send(done, { server: base, token: 'G' });
  assert.equal(last.url, '/message');
  assert.equal(last.headers['x-gotify-key'], 'G');
  assert.deepEqual(json(), { title: done.title, message: done.body, priority: 5 });
});

test('homeassistant', async () => {
  await homeassistant.send(done, { url: base, token: 'H', service: 'mobile_app_phone' });
  assert.equal(last.url, '/api/services/notify/mobile_app_phone');
  assert.equal(last.headers.authorization, 'Bearer H');
  assert.deepEqual(json(), { title: done.title, message: done.body });
});

test('non-2xx and missing config throw with channel name', async () => {
  status = 500;
  await assert.rejects(slack.send(done, { webhookUrl: `${base}/x` }), /slack: HTTP 500/);
  status = 200;
  await assert.rejects(telegram.send(done, {}), /telegram: missing botToken/);
});
