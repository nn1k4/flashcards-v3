// Runtime config loader with Zod validation (fail-fast on startup)
import appJson from '../../config/app.json';
import batchJson from '../../config/batch.json';
import editJson from '../../config/edit.json';
import flashcardsJson from '../../config/flashcards.json';
import i18nJson from '../../config/i18n.json';
import ioJson from '../../config/io.json';
import llmJson from '../../config/llm.json';
import networkJson from '../../config/network.json';
import readingJson from '../../config/reading.json';
import themeJson from '../../config/theme.json';
import translationJson from '../../config/translation.json';

import { ZAppConfig, type AppConfig } from '../types/config/app';
import { ZBatchConfig, type BatchConfig } from '../types/config/batch';
import { ZEditConfig, type EditConfig } from '../types/config/edit';
import { ZFlashcardsConfig, type FlashcardsConfig } from '../types/config/flashcards';
import { ZI18nConfig, type I18nConfig } from '../types/config/i18n';
import { ZIoConfig, type IoConfig } from '../types/config/io';
import { ZLlmConfig, type LlmConfig } from '../types/config/llm';
import { ZNetworkConfig, type NetworkConfig } from '../types/config/network';
import { ZReadingConfig, type ReadingConfig } from '../types/config/reading';
import { ZThemeConfig, type ThemeConfig } from '../types/config/theme';
import { ZTranslationConfig, type TranslationConfig } from '../types/config/translation';

export type AllConfigs = {
  app: AppConfig;
  i18n: I18nConfig;
  theme: ThemeConfig;
  network: NetworkConfig;
  llm: LlmConfig;
  batch: BatchConfig;
  flashcards: FlashcardsConfig;
  reading: ReadingConfig;
  translation: TranslationConfig;
  edit: EditConfig;
  io: IoConfig;
};

export function validateAllConfigs(raw?: Partial<AllConfigs>): AllConfigs {
  // Allow tests to pass overrides; default to importing static JSON
  const app = ZAppConfig.parse(raw?.app ?? appJson);
  const i18n = ZI18nConfig.parse(raw?.i18n ?? i18nJson);
  let theme: ThemeConfig;
  try {
    theme = ZThemeConfig.parse(raw?.theme ?? themeJson);
  } catch {
    const t = (raw?.theme ?? themeJson) as any;
    const def = t?.default;
    const dc = t?.darkClass;
    if (!t || !['light', 'dark', 'system'].includes(def) || typeof dc !== 'string') {
      throw new Error('Invalid theme config');
    }
    theme = { default: def, darkClass: dc, tokens: t.tokens ?? {} } as ThemeConfig;
  }
  const network = ZNetworkConfig.parse(raw?.network ?? networkJson);
  const llm = ZLlmConfig.parse(raw?.llm ?? llmJson);
  const batch = ZBatchConfig.parse(raw?.batch ?? batchJson);
  const flashcards = ZFlashcardsConfig.parse(raw?.flashcards ?? flashcardsJson);
  const reading = ZReadingConfig.parse(raw?.reading ?? readingJson);
  const translation = ZTranslationConfig.parse(raw?.translation ?? translationJson);
  const edit = ZEditConfig.parse(raw?.edit ?? editJson);
  const io = ZIoConfig.parse(raw?.io ?? ioJson);
  return { app, i18n, theme, network, llm, batch, flashcards, reading, translation, edit, io };
}

export const config: AllConfigs = validateAllConfigs();
