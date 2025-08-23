#!/usr/bin/env node
// Validate all /config/*.json against Zod schemas and print a concise report
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const cfgDir = join(root, 'config');

function readJson(name) {
  const p = join(cfgDir, name);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

// JS replicas of schemas (keep in sync with src/types/config/*)
const ZAppConfig = z.object({ appName: z.string().min(1), version: z.string().min(1), defaultLocale: z.string().min(2), supportedLocales: z.array(z.string().min(2)).min(1) });
const ZI18nConfig = z.object({ defaultLocale: z.string().min(2), locales: z.array(z.string().min(2)).min(1) });
const ZNetworkConfig = z.object({ apiBaseUrl: z.string().min(1), requestTimeoutMs: z.number().int().positive(), healthTimeoutMs: z.number().int().positive(), llmRouteBase: z.string().min(1).optional() });
const ZLlmConfig = z.object({ defaultModel: z.string().min(1), maxTokensDefault: z.number().int().positive(), toolChoice: z.string().min(1), promptCaching: z.object({ enabled: z.boolean() }) });
const ZBatchConfig = z.object({ polling: z.object({ stages: z.array(z.object({ fromSec: z.number().nonnegative(), minMs: z.number().positive(), maxMs: z.number().positive() })).min(1), respectRetryAfter: z.boolean() }) });
const ZFlashcardsConfig = z.object({ contexts: z.object({ default: z.number().int().positive(), max: z.number().int().positive() }), fontFamily: z.string().min(1), visibilityPolicy: z.enum(['all-visible', 'reveal-on-peek']) });
const ZReadingConfig = z.object({ tooltip: z.object({ showDelayMs: z.number().int().nonnegative(), debounceMs: z.number().int().nonnegative(), cancelOnLeave: z.boolean(), singleFlight: z.boolean() }) });
const ZTranslationConfig = z.object({ stats: z.object({ words: z.boolean(), graphemes: z.boolean(), sentences: z.boolean(), phrases: z.boolean() }) });
const ZEditConfig = z.object({ pageSize: z.number().int().positive() });
const ZIoConfig = z.object({ import: z.object({ allowed: z.array(z.string().min(1)).min(1), maxFileSizeMB: z.number().int().positive(), defaultMerge: z.enum(['replace-all', 'merge-keep-local', 'merge-prefer-imported']) }), export: z.object({ formats: z.array(z.string().min(1)).min(1), includeMeta: z.boolean() }) });

const entries = [
  ['app.json', ZAppConfig],
  ['i18n.json', ZI18nConfig],
  // theme.json validated manually below to avoid zod enum quirk in this runtime
  ['network.json', ZNetworkConfig],
  ['llm.json', ZLlmConfig],
  ['batch.json', ZBatchConfig],
  ['flashcards.json', ZFlashcardsConfig],
  ['reading.json', ZReadingConfig],
  ['translation.json', ZTranslationConfig],
  ['edit.json', ZEditConfig],
  ['io.json', ZIoConfig],
];

let ok = 0;
const problems = [];
for (const [name, schema] of entries) {
  try {
    const json = readJson(name);
    schema.parse(json);
    ok++;
  } catch (e) {
    problems.push({ name, error: e.errors ? e.errors : String(e) });
  }
}

// Manual validation for theme.json (to work around environment-specific zod enum default bug)
try {
  const name = 'theme.json';
  const json = readJson(name);
  const validDefault = ['light', 'dark', 'system'];
  if (!json || !validDefault.includes(json.default) || typeof json.darkClass !== 'string') {
    throw new Error('Invalid theme config structure');
  }
  ok++;
} catch (e) {
  problems.push({ name: 'theme.json', error: String(e) });
}

if (problems.length === 0) {
  console.log(`✔ Configs valid (${ok}/${entries.length})`);
  process.exit(0);
} else {
  console.error(`✖ Config validation failed (${problems.length} files):`);
  for (const p of problems) console.error(` - ${p.name}:`, JSON.stringify(p.error));
  process.exit(1);
}
