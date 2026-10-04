import { execFileSync } from 'node:child_process';
import { readJson } from './jsonfile.mjs';
import { globalConfigPath, projectConfigPath } from './paths.mjs';
import { loadState } from './state.mjs';
import { logError } from './errorlog.mjs';

export const DEFAULTS = Object.freeze({
  enabled: true,
  channels: ['macos'],
  events: { done: true, waiting: true },
  filters: { always: false, minDurationSec: 60, onlyWhenAwaySec: 0, debounceSec: 0 },
  summary: { mode: 'last-message', maxChars: 300 },
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = deepMerge(a[k], v);
  return out;
}

function readLayer(file) {
  try {
    const v = readJson(file);
    return isPlainObject(v) ? v : {};
  } catch (err) {
    logError(`config: cannot parse ${file}: ${err.message}`);
    return {};
  }
}

export function loadConfig({ cwd, sessionId }) {
  let cfg = structuredClone(DEFAULTS);
  cfg = deepMerge(cfg, readLayer(globalConfigPath()));
  if (cwd) cfg = deepMerge(cfg, readLayer(projectConfigPath(cwd)));
  if (typeof cfg.channels === 'string') cfg.channels = [cfg.channels];
  else if (!Array.isArray(cfg.channels)) cfg.channels = [];
  const override = sessionId ? loadState(sessionId).override : undefined;
  if (isPlainObject(override)) cfg = deepMerge(cfg, override);
  return cfg;
}

export function readKeychain(service) {
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-s', service, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}

export function resolveSecrets(value, { env = process.env, keychain = readKeychain } = {}) {
  if (typeof value === 'string') {
    let resolved;
    if (value.startsWith('env:')) resolved = env[value.slice(4)];
    else if (value.startsWith('keychain:')) resolved = keychain(value.slice(9));
    else return value;
    if (resolved == null || resolved === '') throw new Error(`unresolved secret ${value}`);
    return resolved;
  }
  if (Array.isArray(value)) return value.map((v) => resolveSecrets(v, { env, keychain }));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveSecrets(v, { env, keychain })]),
    );
  }
  return value;
}
