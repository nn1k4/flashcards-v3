import { describe, expect, it } from 'vitest';
import { resolveInitialLocale, t } from '../../stores/i18nStore';

describe('i18n loader', () => {
  it('resolves initial locale from config', () => {
    const loc = resolveInitialLocale();
    expect(['en', 'ru']).toContain(loc);
  });
  it('translates known keys', () => {
    expect(t('en' as any, 'app.title')).toBeTruthy();
    expect(t('ru' as any, 'app.title')).toBeTruthy();
  });
});
