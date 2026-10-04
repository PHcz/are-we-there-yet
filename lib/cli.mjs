import { install, uninstall, installStatus, InstallError } from './install.mjs';
import { loadConfig } from './config.mjs';
import { parseNotifyCommand, applyCommand, describeConfig } from './command.mjs';
import { runJob } from './job.mjs';

const USAGE = `awty — get pinged when your AI coding agent is waiting for you or done

Usage:
  awty install <claude|codex|agy> [--project]    add the notification hooks
  awty uninstall <claude|codex|agy> [--project]  remove them
  awty status                                    settings, last error, installed hooks
  awty test                                      send a test message to every channel
  awty set <global|project> key=value …          change settings (same keys as /awty)
  awty help                                      this text

Settings keys: on|off done= waiting= channel= min= away= debounce= always= summary= max= name=
Docs: https://github.com/PHcz/are-we-there-yet
`;

// Re-quote "key=value with spaces" so the /awty parser keeps it as one value.
const quoteArg = (a) => (/\s/.test(a) && a.includes('=') ? a.replace(/=(.*)$/s, '="$1"') : a);

export async function runCli(args, {
  out = (s) => process.stdout.write(s),
  err = (s) => process.stderr.write(s),
  cwd = process.cwd(),
  run,
} = {}) {
  const [cmd, ...rest] = args;
  const project = rest.includes('--project');
  const positional = rest.filter((a) => a !== '--project');
  const extra = run ? { run } : {};
  try {
    switch (cmd) {
      case 'install': {
        const r = install(positional[0], { project, cwd, ...extra });
        out(`Installed are-we-there-yet for ${positional[0]}${r.file ? ` in ${r.file}` : ''}.\n`);
        for (const note of r.notes) out(`${note}\n`);
        return 0;
      }
      case 'uninstall': {
        const r = uninstall(positional[0], { project, cwd, ...extra });
        out(r.removed
          ? `Removed are-we-there-yet from ${positional[0]}${r.file ? ` (${r.file})` : ''}.\n`
          : `Nothing to remove for ${positional[0]}.\n`);
        return 0;
      }
      case 'status': {
        out(`${describeConfig(loadConfig({ cwd }))}\n\nHooks:\n`);
        for (const s of installStatus({ cwd, ...extra })) {
          const state = s.installed === null ? 'unknown'
            : s.installed === 'stale' ? `installed (stale path — re-run awty install ${s.tool})`
            : s.installed ? 'installed' : '—';
          out(`  ${s.tool.padEnd(7)} ${s.scope.padEnd(8)} ${state}\n`);
        }
        return 0;
      }
      case 'test': {
        const cfg = loadConfig({ cwd });
        const res = await runJob({
          kind: 'test',
          sessionName: 'awty test',
          durationSec: null,
          cwd,
          summaryInput: { text: 'are-we-there-yet is configured correctly.', mode: 'last-message', maxChars: cfg.summary.maxChars },
          cfg,
        });
        out(`Sent: ${res.sent.join(', ') || '(none)'}\n`);
        for (const f of res.failed) err(`Failed: ${f.name}: ${f.error}\n`);
        return res.failed.length ? 1 : 0;
      }
      case 'set': {
        const parsed = parseNotifyCommand(`/awty ${positional.map(quoteArg).join(' ')}`);
        if (parsed.scope === 'session') {
          err('awty set needs a scope: awty set global … or awty set project …\n');
          return 2;
        }
        if (!parsed.errors.length && parsed.action !== 'set') {
          err('awty set needs at least one key=value, e.g. awty set global min=300\n');
          return 2;
        }
        const message = applyCommand(parsed, { cwd, sessionId: 'cli' });
        (parsed.errors.length ? err : out)(`${message}\n`);
        return parsed.errors.length ? 2 : 0;
      }
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        out(USAGE);
        return 0;
      default:
        err(`Unknown command "${cmd}".\n\n${USAGE}`);
        return 2;
    }
  } catch (e) {
    if (e instanceof InstallError) {
      err(`${e.message}\n`);
      return 1;
    }
    throw e;
  }
}
