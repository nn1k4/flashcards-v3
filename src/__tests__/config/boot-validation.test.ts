import { describe, expect, it } from 'vitest';
import { validateAllConfigs } from '../../config';

describe('App boot config validation', () => {
  it('validates default configs', () => {
    const c = validateAllConfigs();
    expect(c.app.appName.length).greaterThan(0);
  });

  it('throws on invalid key', () => {
    expect(() =>
      validateAllConfigs({
        network: { apiBaseUrl: '', requestTimeoutMs: -1, healthTimeoutMs: -1 } as any,
      }),
    ).toThrow();
  });
});
