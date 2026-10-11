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

let server, base, last, status = 200, responder = null;
const requests = [];
before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      last = { method: req.method, url: req.url, headers: req.headers, body };
      requests.push(last);
      const r = responder ? responder(last) : { status, body: 'ok' };
      res.writeHead(r.status).end(r.body);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const done = {
  kind: 'done', emoji: '✅', status: 'Done', duration: '1m 00s', session: 's', tool: '', summary: 'All good',
  project: 'x', time: '10:00', title: '✅ Done · 1m 00s · s', body: 'All good\n\nx · 10:00', text: '✅ Done · 1m 00s · s\nAll good\n\nx · 10:00',
};
const waiting = { ...done, kind: 'waiting', emoji: '❓', status: 'Waiting for you', duration: '', title: '❓ Waiting for you · s' };
const json = () => JSON.parse(last.body);

test('telegram sends the HTML card', async () => {
  await telegram.send(done, { apiBase: base, botToken: 'T', chatId: '42' });
  assert.equal(last.url, '/botT/sendMessage');
  assert.deepEqual(json(), {
    chat_id: '42',
    text: '✅ <b>Done</b> · 1m 00s\n<b>s</b>\n\n<blockquote>All good</blockquote>\n\n<i>x · 10:00</i>',
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
});

test('telegram falls back to plain text when HTML is rejected', async () => {
  requests.length = 0;
  responder = (req) => (JSON.parse(req.body).parse_mode
    ? { status: 400, body: '{"ok":false,"description":"Bad Request: can\'t parse entities: unexpected end tag"}' }
    : { status: 200, body: 'ok' });
  try {
    await telegram.send(done, { apiBase: base, botToken: 'T', chatId: '42' });
  } finally {
    responder = null;
  }
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(requests[1].body), { chat_id: '42', text: done.text, disable_web_page_preview: true });
});

test('telegram does not retry other errors', async () => {
  requests.length = 0;
  responder = () => ({ status: 401, body: 'Unauthorized' });
  try {
    await assert.rejects(telegram.send(done, { apiBase: base, botToken: 'T', chatId: '42' }), /telegram: HTTP 401/);
  } finally {
    responder = null;
  }
  assert.equal(requests.length, 1);
});

test('ntfy posts JSON to server root with priority by kind', async () => {
  await ntfy.send(waiting, { server: base, topic: 'tp', token: 'tk' });
  assert.equal(last.url, '/');
  assert.equal(last.headers.authorization, 'Bearer tk');
  assert.deepEqual(json(), { topic: 'tp', title: waiting.title, message: waiting.body, priority: 4 });
  await ntfy.send(done, { server: base, topic: 'tp' });
  assert.equal(json().priority, 3);
});

test('slack and discord send their native cards', async () => {
  await slack.send(done, { webhookUrl: `${base}/slack` });
  assert.deepEqual(json(), { text: '✅ *Done* · 1m 00s\n*s*\n\n> All good\n\n_x · 10:00_' });
  await discord.send(done, { webhookUrl: `${base}/discord` });
  assert.deepEqual(json(), { content: '✅ **Done** · 1m 00s\n**s**\n\n> All good\n\n*x · 10:00*', allowed_mentions: { parse: [] } });
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
  assert.deepEqual(json(), { device_key: 'K', title: waiting.title, body: waiting.body, level: 'timeSensitive', group: 'awty' });
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
