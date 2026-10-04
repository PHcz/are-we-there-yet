import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RUN_PATH = fileURLToPath(new URL('../bin/run.sh', import.meta.url));
export const PACKAGE_ROOT = path.dirname(path.dirname(RUN_PATH));

const AGY_KEY = 'are-we-there-yet';
const CODEX_EVENTS = ['UserPromptSubmit', 'PermissionRequest', 'Stop'];
const MARKETPLACE = 'are-we-there-yet-local';
const PLUGIN = `are-we-there-yet@${MARKETPLACE}`;

export class InstallError extends Error {}

const codexHome = () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const command = (tool, extra = '') => `"${RUN_PATH}" --tool ${tool}${extra}`;
const isOurs = (tool) => (h) => typeof h?.command === 'string' && h.command.includes('run.sh"') && h.command.includes(`--tool ${tool}`);

export function targetFile(tool, { project = false, cwd = process.cwd() } = {}) {
  if (tool === 'codex') return project ? path.join(cwd, '.codex', 'hooks.json') : path.join(codexHome(), 'hooks.json');
  if (tool === 'agy') return project ? path.join(cwd, '.agents', 'hooks.json') : path.join(os.homedir(), '.gemini', 'config', 'hooks.json');
  throw new InstallError(`unknown tool "${tool}" (use claude, codex or agy)`);
}

function readConfig(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('top level is not an object');
    return value;
  } catch (err) {
    throw new InstallError(`${file} is not valid JSON (${err.message}); fix it by hand first`);
  }
}

function writeConfig(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backup = `${file}.awty-backup`;
  if (fs.existsSync(file) && !fs.existsSync(backup)) fs.copyFileSync(file, backup);
  // Resolve symlinked dotfiles so the link survives, and swap the file in atomically.
  let real = file;
  let mode;
  try {
    real = fs.realpathSync(file);
    mode = fs.statSync(real).mode & 0o777;
  } catch {}
  const tmp = `${real}.awty-tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    if (mode !== undefined) fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, real);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const refuse = (file, what) => new InstallError(`${file}: ${what}; fix it by hand first`);

function codexHooks(doc, file) {
  if (doc.hooks === undefined) return {};
  if (!isPlainObject(doc.hooks)) throw refuse(file, '"hooks" is not an object');
  return doc.hooks;
}

function eventGroups(hooks, event, file) {
  const groups = hooks[event];
  if (groups === undefined) return [];
  if (!Array.isArray(groups)) throw refuse(file, `"hooks.${event}" is not an array`);
  return groups;
}

// Remove only our hook entries; drop a group only when it held ours and is now empty.
function stripOurs(groups) {
  let removed = false;
  const kept = [];
  for (const g of groups) {
    if (!Array.isArray(g?.hooks)) {
      kept.push(g);
      continue;
    }
    const rest = g.hooks.filter((h) => !isOurs('codex')(h));
    if (rest.length === g.hooks.length) kept.push(g);
    else {
      removed = true;
      if (rest.length) kept.push({ ...g, hooks: rest });
    }
  }
  return { kept, removed };
}

function agyEntry() {
  return {
    PreToolUse: [{ matcher: 'ask_question|ask_permission', hooks: [{ type: 'command', command: command('agy', ' --event PreToolUse'), timeout: 10 }] }],
    Stop: [{ type: 'command', command: command('agy', ' --event Stop'), timeout: 10 }],
  };
}

const INSTALL_HELP = `Run these yourself:\n  claude plugin marketplace add "${PACKAGE_ROOT}"\n  claude plugin install ${PLUGIN}`;

function runClaude(args, run, help = INSTALL_HELP) {
  const r = run('claude', args, { encoding: 'utf8', timeout: 120000 });
  if (r.error?.code === 'ENOENT') throw new InstallError(`claude not found on PATH. ${help}`);
  return r;
}

const WHICH = 'which tool? use: awty install <claude|codex|agy>';
const output = (r) => `${r.stderr || r.stdout || ''}`.trim().slice(0, 300);
const allOutput = (r) => `${r.stderr ?? ''}${r.stdout ?? ''}`;

export function install(tool, { project = false, cwd = process.cwd(), run = spawnSync } = {}) {
  if (!tool) throw new InstallError(WHICH);
  if (tool === 'claude') {
    if (project) throw new InstallError('Claude Code plugins install per user; --project is not supported for claude');
    const added = runClaude(['plugin', 'marketplace', 'add', PACKAGE_ROOT], run);
    if (added.status !== 0 && !/already/i.test(`${added.stderr ?? ''}${added.stdout ?? ''}`)) {
      throw new InstallError(`claude plugin marketplace add failed: ${`${added.stderr || added.stdout || ''}`.trim().slice(0, 300)}`);
    }
    const installed = runClaude(['plugin', 'install', PLUGIN], run);
    if (installed.status !== 0) {
      throw new InstallError(`claude plugin install failed: ${`${installed.stderr || installed.stdout || ''}`.trim().slice(0, 300)}`);
    }
    const notes = [];
    if (/already installed/i.test(allOutput(installed))) {
      for (const args of [['plugin', 'marketplace', 'update', MARKETPLACE], ['plugin', 'update', PLUGIN]]) {
        const u = runClaude(args, run);
        if (u.status !== 0) throw new InstallError(`claude ${args.join(' ')} failed: ${output(u)}`);
      }
      notes.push('Updated the Claude Code plugin to this version.');
    }
    notes.push('Start a new Claude Code session, or type /reload-plugins in a running one.');
    return { notes };
  }
  const file = targetFile(tool, { project, cwd });
  const doc = readConfig(file);
  const notes = [];
  if (tool === 'codex') {
    const hooks = codexHooks(doc, file);
    for (const event of CODEX_EVENTS) {
      const { kept } = stripOurs(eventGroups(hooks, event, file));
      hooks[event] = [...kept, { hooks: [{ type: 'command', command: command('codex') }] }];
    }
    writeConfig(file, { ...doc, hooks });
    notes.push('Codex asks you to approve new hooks: start codex and accept them, or type /hooks.');
    notes.push('In a Codex session, type "awty status" (no slash) to see or change settings.');
  } else {
    writeConfig(file, { ...doc, [AGY_KEY]: agyEntry() });
    if (project) notes.push('Note: Antigravity CLI may ignore workspace hooks (issue #1036); prefer the global install.');
    notes.push('Antigravity has no in-session command; use "awty status" / "awty set" in a terminal.');
  }
  return { file, notes };
}

export function uninstall(tool, { project = false, cwd = process.cwd(), run = spawnSync } = {}) {
  if (!tool) throw new InstallError(WHICH);
  if (tool === 'claude') {
    const r = runClaude(['plugin', 'uninstall', PLUGIN], run, `Run yourself:\n  claude plugin uninstall ${PLUGIN}`);
    if (r.status !== 0) throw new InstallError(`claude plugin uninstall failed: ${output(r)}`);
    return { removed: true };
  }
  const file = targetFile(tool, { project, cwd });
  if (!fs.existsSync(file)) return { file, removed: false };
  const doc = readConfig(file);
  if (tool === 'codex') {
    const hooks = codexHooks(doc, file);
    for (const event of Object.keys(hooks)) eventGroups(hooks, event, file);
    let removed = false;
    for (const event of Object.keys(hooks)) {
      const groups = hooks[event];
      const { kept, removed: did } = stripOurs(groups);
      if (!did) continue;
      removed = true;
      if (kept.length) hooks[event] = kept;
      else delete hooks[event];
    }
    if (removed) writeConfig(file, { ...doc, hooks });
    return { file, removed };
  }
  if (!(AGY_KEY in doc)) return { file, removed: false };
  delete doc[AGY_KEY];
  writeConfig(file, doc);
  return { file, removed: true };
}

const commandPath = (c) => /^"([^"]+)"/.exec(c)?.[1];
const isFresh = (c) => {
  const p = commandPath(c);
  return p === RUN_PATH && fs.existsSync(p);
};

function collectCommands(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collectCommands(n, out));
  else if (isPlainObject(node)) {
    if (typeof node.command === 'string') out.push(node.command);
    Object.values(node).forEach((v) => collectCommands(v, out));
  }
  return out;
}

function fileHasOurs(tool, file) {
  let doc;
  try {
    doc = readConfig(file);
  } catch {
    return null;
  }
  let commands;
  if (tool === 'agy') {
    if (!(AGY_KEY in doc)) return false;
    commands = collectCommands(doc[AGY_KEY]);
  } else {
    const hooks = isPlainObject(doc.hooks) ? doc.hooks : {};
    commands = [];
    for (const groups of Object.values(hooks)) {
      for (const g of Array.isArray(groups) ? groups : []) {
        for (const h of Array.isArray(g?.hooks) ? g.hooks : []) if (isOurs('codex')(h)) commands.push(h.command);
      }
    }
    if (!commands.length) return false;
  }
  return commands.every(isFresh) ? true : 'stale';
}

export function installStatus({ cwd = process.cwd(), run = spawnSync } = {}) {
  const r = run('claude', ['plugin', 'list'], { encoding: 'utf8', timeout: 15000 });
  const claude = r.error ? null : r.status === 0 && String(r.stdout ?? '').includes(PLUGIN);
  const rows = [{ tool: 'claude', scope: 'user', installed: claude }];
  for (const tool of ['codex', 'agy']) {
    rows.push({ tool, scope: 'global', installed: fileHasOurs(tool, targetFile(tool)) });
    rows.push({ tool, scope: 'project', installed: fileHasOurs(tool, targetFile(tool, { project: true, cwd })) });
  }
  return rows;
}
