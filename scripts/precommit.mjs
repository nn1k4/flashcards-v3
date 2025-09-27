// scripts/precommit.mjs
// Кроссплатформенный запуск lint-staged через Node (без npm/npx)
import lintStaged from 'lint-staged';
import path from 'node:path';

// Ensure local binaries (prettier/eslint) are resolvable cross‑platform
const localBin = path.resolve(process.cwd(), 'node_modules/.bin');
process.env.PATH = `${localBin}${path.delimiter}${process.env.PATH || ''}`;

try {
  const ok = await lintStaged(); // читает конфиг из package.json / lint-staged.config.*
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
}
