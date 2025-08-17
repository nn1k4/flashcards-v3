// scripts/precommit.mjs
// Кроссплатформенный запуск lint-staged через Node (без npm/npx)
import lintStaged from 'lint-staged';

try {
  const ok = await lintStaged(); // читает конфиг из package.json / lint-staged.config.*
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
}
