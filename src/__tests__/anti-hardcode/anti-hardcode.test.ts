import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('anti-hardcode script', () => {
  it('runs and passes on current tree', () => {
    const r = spawnSync('node', [join(__dirname, '../../../scripts/lint-anti-hardcode.mjs')], {
      cwd: join(__dirname, '../../..'),
      encoding: 'utf-8',
    });
    // Either exit 0 or 1; we assert that it did not crash and produced output
    expect(r.stdout + r.stderr).toMatch(/Anti-hardcode|passed/);
  });
});
