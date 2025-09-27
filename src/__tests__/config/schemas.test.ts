import { describe, expect, it } from 'vitest';
import { ZAppConfig } from '../../types/config/app';
import { ZBatchConfig } from '../../types/config/batch';
import { ZEditConfig } from '../../types/config/edit';
import { ZFlashcardsConfig } from '../../types/config/flashcards';
import { ZI18nConfig } from '../../types/config/i18n';
import { ZIoConfig } from '../../types/config/io';
import { ZLlmConfig } from '../../types/config/llm';
import { ZNetworkConfig } from '../../types/config/network';
import { ZNlpConfig } from '../../types/config/nlp';
import { ZReadingConfig } from '../../types/config/reading';
import { ZThemeConfig } from '../../types/config/theme';
import { ZTranslationConfig } from '../../types/config/translation';

describe('Zod config schemas', () => {
  it('accepts valid minimal objects', () => {
    expect(() =>
      ZAppConfig.parse({
        appName: 'x',
        version: '1',
        defaultLocale: 'en',
        supportedLocales: ['en'],
      }),
    ).not.toThrow();
    expect(() => ZNlpConfig.parse({ segmentation: { engine: 'primitive' } })).not.toThrow();
    expect(() => ZI18nConfig.parse({ defaultLocale: 'en', locales: ['en', 'ru'] })).not.toThrow();
    expect(() =>
      ZThemeConfig.parse({ default: 'system', darkClass: 'dark', tokens: {} }),
    ).not.toThrow();
    expect(() =>
      ZNetworkConfig.parse({ apiBaseUrl: '/api', requestTimeoutMs: 1000, healthTimeoutMs: 1000 }),
    ).not.toThrow();
    expect(() =>
      ZLlmConfig.parse({
        defaultModel: 'claude-3',
        maxTokensDefault: 100,
        toolChoice: 'flashcards_emitter',
        promptCaching: { enabled: true },
      }),
    ).not.toThrow();
    expect(() =>
      ZBatchConfig.parse({
        polling: { stages: [{ fromSec: 0, minMs: 1000, maxMs: 2000 }], respectRetryAfter: true },
      }),
    ).not.toThrow();
    expect(() =>
      ZFlashcardsConfig.parse({
        contexts: { default: 1, max: 3 },
        fontFamily: 'Noto Sans Display',
        visibilityPolicy: 'all-visible',
      }),
    ).not.toThrow();
    expect(() =>
      ZReadingConfig.parse({
        tooltip: { showDelayMs: 0, debounceMs: 0, cancelOnLeave: true, singleFlight: true },
      }),
    ).not.toThrow();
    expect(() =>
      ZTranslationConfig.parse({
        stats: { words: true, graphemes: true, sentences: true, phrases: true },
      }),
    ).not.toThrow();
    expect(() => ZEditConfig.parse({ pageSize: 10 })).not.toThrow();
    expect(() =>
      ZIoConfig.parse({
        import: { allowed: ['json'], maxFileSizeMB: 10, defaultMerge: 'merge-prefer-imported' },
        export: { formats: ['json'], includeMeta: true },
      }),
    ).not.toThrow();
  });

  it('rejects invalid values', () => {
    expect(() =>
      ZNetworkConfig.parse({ apiBaseUrl: '', requestTimeoutMs: -1, healthTimeoutMs: 0 }),
    ).toThrow();
    expect(() => ZEditConfig.parse({ pageSize: 0 })).toThrow();
  });
});
