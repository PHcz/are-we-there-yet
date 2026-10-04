import path from 'node:path';
import { readHeadLines, readTailLines, customTitle, firstUserPrompt } from './transcript.mjs';

export function firstWords(text, n = 6) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  return words.length > n ? `${words.slice(0, n).join(' ')}…` : words.join(' ');
}

export function resolveSessionName({ cfg, cwd, transcriptPath, state }) {
  if (cfg?.name) return cfg.name;
  if (transcriptPath) {
    const title = customTitle(readTailLines(transcriptPath));
    if (title) return title;
  }
  const project = path.basename(cwd || process.cwd());
  const prompt = state?.firstPrompt ?? (transcriptPath ? firstUserPrompt(readHeadLines(transcriptPath)) : null);
  return prompt ? `${project} · ${firstWords(prompt, 6)}` : project;
}
