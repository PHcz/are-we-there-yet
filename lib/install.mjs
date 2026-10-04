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
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const withoutOurCodexGroups = (groups) =>
  (Array.isArray(groups) ? groups : []).filter((g) => !(g?.hooks ?? []).some(isOurs('codex')));

function codexHooks(doc) {
  return doc.hooks && typeof doc.hooks === 'object' && !Array.isArray(doc.hooks) ? doc.hooks : {};
}

function agyEntry() {
  return {
    PreToolUse: [{ matcher: 'ask_question|ask_permission', hooks: [{ type: 'command', command: command('agy', ' --event PreToolUse'), timeout: 10 }] }],
    Stop: [{ type: 'command', command: command('agy', ' --event Stop'), timeout: 10 }],
  };
}

function runClaude(args, run) {
  const r = run('claude', args, { encoding: 'utf8', timeout: 120000 });
  if (r.error?.code === 'ENOENT') {
    throw new InstallError(`claude not found on PATH. Run these yourself:\n  claude plugin marketplace add "${PACKAGE_ROOT}"\n  claude plugin install ${PLUGIN}`);
  }
  return r;
}

export function install(tool, { project = false, cwd = process.cwd(), run = spawnSync } = {}) {
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
    return { notes: ['Start a new Claude Code session, or type /reload-plugins in a running one.'] };
  }
  const file = targetFile(tool, { project, cwd });
  const doc = readConfig(file);
  const notes = [];
  if (tool === 'codex') {
    const hooks = codexHooks(doc);
    for (const event of CODEX_EVENTS) {
      hooks[event] = [...withoutOurCodexGroups(hooks[event]), { hooks: [{ type: 'command', command: command('codex') }] }];
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
  if (tool === 'claude') {
    const r = runClaude(['plugin', 'uninstall', PLUGIN], run);
    return { removed: r.status === 0 };
  }
  const file = targetFile(tool, { project, cwd });
  if (!fs.existsSync(file)) return { file, removed: false };
  const doc = readConfig(file);
  if (tool === 'codex') {
    const hooks = codexHooks(doc);
    let removed = false;
    for (const [event, groups] of Object.entries(hooks)) {
      const kept = withoutOurCodexGroups(groups);
      if (kept.length !== (Array.isArray(groups) ? groups.length : 0)) removed = true;
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

function fileHasOurs(tool, file) {
  let doc;
  try {
    doc = readConfig(file);
  } catch {
    return null;
  }
  if (tool === 'agy') return AGY_KEY in doc;
  return Object.values(codexHooks(doc)).some((groups) => (Array.isArray(groups) ? groups : []).some((g) => (g?.hooks ?? []).some(isOurs('codex'))));
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
