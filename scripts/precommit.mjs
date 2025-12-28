// scripts/precommit.mjs
// Кроссплатформенный запуск lint-staged через Node (без npm/npx)
import lintStaged from 'lint-staged';
import path from 'node:path';
import { createRequire } from 'node:module';

// Ensure local binaries (prettier/eslint) are resolvable cross‑platform (fallback for shells without .bin on PATH)
const localBin = path.resolve(process.cwd(), 'node_modules/.bin');
process.env.PATH = `${localBin}${path.delimiter}${process.env.PATH || ''}`;

// Resolve absolute paths to CLI entry points (works on Windows/Linux/macOS)
const require = createRequire(import.meta.url);
let eslintBin = '';
let prettierBin = '';
try {
  eslintBin = require.resolve('eslint/bin/eslint.js');
} catch {
  // intentionally empty
}
try {
  const prettierPkg = require.resolve('prettier/package.json');
  prettierBin = path.resolve(path.dirname(prettierPkg), 'bin/prettier.cjs');
} catch {
  // intentionally empty
}

// Programmatic lint-staged config with absolute executables to avoid "not recognized" on Windows
const config = {};
if (eslintBin) {
  config['*.{ts,tsx,js,jsx}'] = [
    `node "${eslintBin}" --fix`,
    prettierBin ? `node "${prettierBin}" --write` : 'prettier --write',
  ];
} else {
  config['*.{ts,tsx,js,jsx}'] = ['prettier --write'];
}
config['*.{json,md,css,html,yml,yaml}'] = [
  prettierBin ? `node "${prettierBin}" --write` : 'prettier --write',
];

try {
  const ok = await lintStaged({ config });
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
}
