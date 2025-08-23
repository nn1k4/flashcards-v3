#!/usr/bin/env node
/* eslint-disable no-useless-escape */
// Simple anti-hardcode check (ESM): scan src/** for forbidden literals that must live in /config
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const SRC = join(root, 'src');

const FORBIDDEN = [
  /\bclaude[-_\w]*\b/i,
  /\bgpt[-_\w]*\b/i,
  /\b(\d{3,5})\s*(ms|milliseconds)\b/i,
  /\bArrow(Left|Right|Up|Down)\b/,
  /\bSpace\b/,
  /\bpageSize\s*[:=]\s*\d+/i,
  /\bmaxTokens?\b/i,
];

const ALLOW_PATH = [
  /src[\/\\](types|config)[\/\\]/, // cross-platform separators
  /scripts[\/\\]lint-anti-hardcode\.mjs$/,
  /config[\/\\]/,
  /__tests__[\/\\]/,
];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (s.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(e)) acc.push(p);
  }
  return acc;
}

function isAllowed(file) {
  return ALLOW_PATH.some((re) => re.test(file));
}

const files = walk(SRC);
const violations = [];
for (const f of files) {
  if (isAllowed(f)) continue;
  const txt = readFileSync(f, 'utf-8');
  FORBIDDEN.forEach((re) => {
    if (re.test(txt)) violations.push({ file: f, pattern: String(re) });
  });
}

if (violations.length) {
  console.error('Anti-hardcode violations:');
  for (const v of violations) console.error(` - ${v.file} :: ${v.pattern}`);
  process.exit(1);
}
console.log('✔ Anti-hardcode check passed');
