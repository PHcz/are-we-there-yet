import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpHome } from './helpers.mjs';
import { writeJson } from '../lib/jsonfile.mjs';
import { globalConfigPath } from '../lib/paths.mjs';
import { readTailLines } from '../lib/transcript.mjs';
import { handle } from '../lib/hook.mjs';
import * as agy from '../adapters/agy.mjs';

const dir = fileURLToPath(new URL('./fixtures/agy/', import.meta.url));
const TRANSCRIPT = `${dir}transcript.jsonl`;
const fx = (n) => ({ ...JSON.parse(fs.readFileSync(`${dir}${n}.json`, 'utf8')), transcriptPath: TRANSCRIPT });

beforeEach(() => {
  tmpHome();
  writeJson(globalConfigPath(), { channels: ['telegram'] });
});

test('Stop (fullyIdle) becomes done with last reply, first prompt and turn start', () => {
  const e = agy.normalize(fx('stop'), { event: 'Stop' });
  assert.equal(e.type, 'done');
  assert.equal(e.tool, 'agy');
  assert.equal(e.sessionId, '7a4c102d-60ce-4a6b-af70-2b6ef86ec501');
  assert.equal(e.cwd, '/Users/jane/code/demo');
  assert.match(e.text, /^The command completed with exit code 0:/);
  assert.equal(e.firstPrompt, 'create a file hello4.txt containing hi');
  assert.equal(e.turnStartedAt, Date.parse('2026-10-04T15:39:47Z'));
});

test('Stop that is not fully idle is ignored', () => {
  assert.equal(agy.normalize({ ...fx('stop'), fullyIdle: false }, { event: 'Stop' }), null);
});

test('ask_question becomes a question with options', () => {
  const e = agy.normalize(fx('pre-tool-use-ask-question'), { event: 'PreToolUse' });
  assert.equal(e.type, 'question');
  assert.equal(e.text, 'What is your favourite colour? (Blue / Red / Green / Purple / Yellow)');
});

test('ask_permission becomes a question with reason and target', () => {
  const raw = { ...fx('pre-tool-use-ask-question'), toolCall: { name: 'ask_permission', args: { Action: 'write', Target: '/etc/hosts', Reason: 'Needs to add a host entry' } } };
  assert.equal(agy.normalize(raw, { event: 'PreToolUse' }).text, 'Needs to add a host entry — write /etc/hosts');
});

test('other tools, other events and missing ids are ignored', () => {
  assert.equal(agy.normalize(fx('pre-tool-use-run-command'), { event: 'PreToolUse' }), null);
  assert.equal(agy.normalize(fx('pre-tool-use-write-to-file'), { event: 'PreToolUse' }), null);
  assert.equal(agy.normalize(fx('stop'), { event: 'PostInvocation' }), null);
  assert.equal(agy.normalize(fx('stop'), {}), null);
  assert.equal(agy.normalize({}, { event: 'Stop' }), null);
});

test('missing transcript still yields a done event with empty text', () => {
  const e = agy.normalize({ ...fx('stop'), transcriptPath: '/nonexistent/t.jsonl' }, { event: 'Stop' });
  assert.equal(e.text, '');
  assert.equal(e.firstPrompt, undefined);
});

test('helpers read the transcript format', () => {
  const entries = readTailLines(TRANSCRIPT);
  assert.match(agy.lastReply(entries), /^The command completed/);
  assert.equal(agy.lastUserInputAt(entries), Date.parse('2026-10-04T15:39:47Z'));
  assert.equal(agy.firstPrompt(TRANSCRIPT), 'create a file hello4.txt containing hi');
});

test('respond never prints anything, even for a block', () => {
  assert.equal(agy.respond({ block: { reason: 'x' } }), '');
});

test('done job is named "Antigravity · demo · <first prompt>"', () => {
  const r = handle(agy.normalize(fx('stop'), { event: 'Stop' }), { now: Date.parse('2026-10-04T15:41:00Z'), idle: () => null, label: agy.label });
  assert.equal(r.job.sessionName, 'Antigravity · demo · create a file hello4.txt containing hi');
  assert.equal(r.job.durationSec, 73);
});

test('questions without text and empty permission requests are not notifications', () => {
  const base = { conversationId: 'c1', workspacePaths: ['/x'] };
  const ask = (args) => agy.normalize({ ...base, toolCall: { name: 'ask_question', args } }, { event: 'PreToolUse' });
  assert.equal(ask({ questions: [{ options: ['a'] }] }), null);
  assert.equal(ask({ questions: [] }), null);
  assert.equal(ask({}), null);
  assert.equal(ask({ questions: [{ question: '  ' }, { question: 'Real?' }] }).text, 'Real?');
  assert.equal(agy.normalize({ ...base, toolCall: { name: 'ask_permission', args: {} } }, { event: 'PreToolUse' }), null);
});
