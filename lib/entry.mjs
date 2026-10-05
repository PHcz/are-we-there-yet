import { ADAPTERS } from '../adapters/index.mjs';
import { handle } from './hook.mjs';
import { logError } from './errorlog.mjs';

export function parseHookArgs(args) {
  const out = { tool: 'claude', event: undefined };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool') out.tool = args[++i];
    else if (args[i] === '--event') out.event = args[++i];
  }
  return out;
}

export function prepareHook({ tool, event, stdin }, opts = {}) {
  const adapter = ADAPTERS[tool];
  if (!adapter) {
    logError(`hook: unknown tool ${tool}`);
    return {};
  }
  let raw;
  try {
    raw = JSON.parse(stdin || '{}');
  } catch (err) {
    logError(`hook: invalid JSON from ${tool}: ${err.message}`);
    return {};
  }
  let normalized;
  try {
    normalized = adapter.normalize(raw, { event });
  } catch (err) {
    logError(`adapter ${tool}: ${err.message}`);
    return {};
  }
  if (!normalized) return {};
  const { result, job } = handle(normalized, { ...opts, label: adapter.label, command: adapter.commandWord });
  return { out: adapter.respond(result), job };
}
