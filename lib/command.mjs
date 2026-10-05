import { deepMerge } from './config.mjs';
import { readJson, writeJson } from './jsonfile.mjs';
import { globalConfigPath, projectConfigPath } from './paths.mjs';
import { updateState } from './state.mjs';
import { readLastError } from './errorlog.mjs';

const PREFIX = /^\/(?:are-we-there-yet:)?awty(?:\s+|$)/;
const TOKEN = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))|(\S+)/g;

function parseBool(v) {
  if (/^(on|true|yes|1)$/i.test(v)) return true;
  if (/^(off|false|no|0)$/i.test(v)) return false;
  return undefined;
}

function parseSeconds(v) {
  return /^\d+$/.test(v) ? Number(v) : undefined;
}

const parseList = (v) => {
  const list = v.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
};

const KEYS = Object.assign(Object.create(null), {
  done: ['events.done', parseBool],
  waiting: ['events.waiting', parseBool],
  channel: ['channels', parseList],
  channels: ['channels', parseList],
  min: ['filters.minDurationSec', parseSeconds],
  away: ['filters.onlyWhenAwaySec', parseSeconds],
  debounce: ['filters.debounceSec', parseSeconds],
  always: ['filters.always', parseBool],
  summary: ['summary.mode', (v) => (['llm', 'last-message'].includes(v) ? v : undefined)],
  max: ['summary.maxChars', parseSeconds],
  name: ['name', (v) => v || undefined],
});

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = o[p] ??= {};
  o[parts.at(-1)] = value;
}

export function parseNotifyCommand(prompt) {
  const text = String(prompt ?? '').trim();
  if (!PREFIX.test(text)) return null;
  const cmd = { scope: 'session', action: 'status', patch: {}, errors: [] };
  const rest = text.replace(PREFIX, '');
  let first = true;
  for (const m of rest.matchAll(TOKEN)) {
    const [, key, dq, sq, bare, word] = m;
    if (word !== undefined) {
      if (first && (word === 'global' || word === 'project')) cmd.scope = word;
      else if (word === 'on' || word === 'off') {
        cmd.patch.enabled = word === 'on';
        if (cmd.action === 'status') cmd.action = 'set';
      } else if (word === 'reset' || word === 'test') cmd.action = word;
      else if (word === 'status') { /* explicit form of the default action */ }
      else cmd.errors.push(`unknown word "${word}"`);
    } else {
      const spec = KEYS[key];
      const raw = dq ?? sq ?? bare;
      if (!spec) cmd.errors.push(`unknown setting "${key}"`);
      else {
        const value = spec[1](raw);
        if (value === undefined) cmd.errors.push(`invalid value for ${key}: "${raw}"`);
        else {
          setPath(cmd.patch, spec[0], value);
          if (cmd.action === 'status') cmd.action = 'set';
        }
      }
    }
    first = false;
  }
  if ((cmd.action === 'reset' || cmd.action === 'test') && Object.keys(cmd.patch).length) {
    cmd.errors.push(`"${cmd.action}" cannot be combined with settings`);
  }
  return cmd;
}

const SCOPE_LABEL = { session: 'this session', project: 'this project', global: 'all sessions (global)' };

export function applyCommand(cmd, { cwd, sessionId, commandWord = '/awty' }) {
  if (cmd.errors.length) {
    return `are-we-there-yet: nothing changed.\n- ${cmd.errors.join('\n- ')}\nUsage: ${commandWord} [global|project] [on|off] [done=on|off] [waiting=on|off] [channel=a,b] [min=N] [away=N] [debounce=N] [always=on|off] [summary=llm|last-message] [max=N] [name="..."] | reset | test`;
  }
  if (cmd.action === 'reset') {
    if (cmd.scope !== 'session') return 'are-we-there-yet: reset only applies to the session layer; edit the config file directly.';
    updateState(sessionId, ({ override, ...rest }) => rest);
    return 'are-we-there-yet: session overrides cleared.';
  }
  if (cmd.action !== 'set') return null;
  if (cmd.scope === 'session') {
    updateState(sessionId, (s) => ({ ...s, override: deepMerge(s.override ?? {}, cmd.patch) }));
  } else {
    const file = cmd.scope === 'global' ? globalConfigPath() : projectConfigPath(cwd);
    let current = {};
    try {
      current = readJson(file) ?? {};
    } catch {
      return `are-we-there-yet: ${file} is not valid JSON; fix it by hand first.`;
    }
    writeJson(file, deepMerge(current, cmd.patch));
  }
  return `are-we-there-yet: updated ${SCOPE_LABEL[cmd.scope]}.`;
}

export function describeConfig(cfg) {
  const f = cfg.filters;
  const lines = [
    `Notifications: ${cfg.enabled ? 'ON' : 'OFF'}${cfg.name ? ` · session name "${cfg.name}"` : ''}`,
    `Channels: ${cfg.channels.length ? cfg.channels.join(', ') : '(none)'}`,
    `Events: done=${cfg.events.done ? 'on' : 'off'} waiting=${cfg.events.waiting ? 'on' : 'off'}`,
    `Filters: ${f.always ? 'always' : `min=${f.minDurationSec}s away=${f.onlyWhenAwaySec}s debounce=${f.debounceSec}s`}`,
    `Summary: ${cfg.summary.mode} (max ${cfg.summary.maxChars} chars)`,
  ];
  const last = readLastError();
  if (last) lines.push(`Last error: ${last}`);
  return lines.join('\n');
}
