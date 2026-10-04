import { execFileSync } from 'node:child_process';

export const WAITING_DEDUPE_MS = 120000;

export function shouldNotify({ kind, source, cfg, state, now, idleSec }) {
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!cfg.events?.[kind]) return { ok: false, reason: `event ${kind} off` };
  const f = cfg.filters ?? {};
  const bypass = kind === 'done' && f.always;

  if (kind === 'waiting' && source === 'notification' && state.lastWaitingSentAt &&
      now - state.lastWaitingSentAt < WAITING_DEDUPE_MS) {
    return { ok: false, reason: 'deduped' };
  }
  if (kind === 'done' && !bypass) {
    if (f.minDurationSec > 0 && state.turnStartedAt && (now - state.turnStartedAt) / 1000 < f.minDurationSec) {
      return { ok: false, reason: 'too short' };
    }
    if (f.debounceSec > 0 && state.lastDoneSentAt && now - state.lastDoneSentAt < f.debounceSec * 1000) {
      return { ok: false, reason: 'debounced' };
    }
  }
  if (!bypass && f.onlyWhenAwaySec > 0 && idleSec != null && idleSec < f.onlyWhenAwaySec) {
    return { ok: false, reason: 'user active' };
  }
  return { ok: true };
}

const ioregRunner = () =>
  execFileSync('/usr/sbin/ioreg', ['-c', 'IOHIDSystem', '-d', '4'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });

export function getIdleSeconds({ platform = process.platform, run = ioregRunner } = {}) {
  if (platform !== 'darwin') return null;
  try {
    const m = /"HIDIdleTime"\s*=\s*(\d+)/.exec(run());
    return m ? Math.floor(Number(m[1]) / 1e9) : null;
  } catch {
    return null;
  }
}
