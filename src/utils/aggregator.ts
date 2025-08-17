// src/utils/aggregator.ts
// Агрегатор результатов по SID + каноникализация RU + метрики
// ВАЖНО: MANIFEST-FIRST — LV текст и порядок всегда из манифеста.

import type { ProcessingMetrics } from '../types/core';
import type { BatchResultItemV1, BatchResultV1, Flashcard } from '../types/dto';
import type { Manifest } from '../types/manifest';
import { normalizeText } from './splitter';

export type AggregatedBySid = Map<
  number,
  {
    ru: string[];
    cards: Flashcard[];
    warnings: string[];
  }
>;

/** Канонический выбор RU по частоте и длине; при необходимости добавляем финальную точку. */
export function pickCanonicalRussian(variants: string[], ensureDot: boolean = true): string {
  if (variants.length === 0) return '';
  if (variants.length === 1) return ensureDot ? ensureEnding(variants[0]!) : variants[0]!;

  const freq = new Map<string, { count: number; orig: string; len: number }>();
  for (const v of variants) {
    const t = v.trim();
    if (!t) continue;
    const key = normalizeText(t)
      .toLowerCase()
      .replace(/[.!?…]+$/, '');
    if (!key) continue;

    const prev = freq.get(key);
    if (prev) {
      prev.count++;
      if (t.length > prev.len) {
        prev.orig = t;
        prev.len = t.length;
      }
    } else {
      freq.set(key, { count: 1, orig: t, len: t.length });
    }
  }

  let best: { count: number; orig: string; len: number } | null = null;
  for (const v of freq.values()) {
    if (!best || v.count > best.count || (v.count === best.count && v.len > best.len)) best = v;
  }
  if (!best) return '';
  return ensureDot ? ensureEnding(best.orig) : best.orig;
}

function ensureEnding(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** Обработать один элемент результата: сигнатуры, RU, карточки, предупреждения. */
function applyResultItem(
  manifest: Manifest,
  aggregated: AggregatedBySid,
  metrics: ProcessingMetrics,
  item: BatchResultItemV1,
): void {
  const manifestItem = manifest.items[item.sid];
  if (!manifestItem) {
    metrics.schemaViolations++;
    return;
  }

  if (manifestItem.sig !== item.sig) metrics.invalidSigs++; // фиксируем, но продолжаем

  const bucket = aggregated.get(item.sid)!;

  if (item.russian !== undefined) {
    const trimmed = item.russian.trim();
    if (!trimmed) metrics.emptyRussian++;
    else if (bucket.ru.includes(trimmed)) metrics.duplicateRussian++;
    else bucket.ru.push(trimmed);
  }

  if (item.cards?.length) {
    const enriched = item.cards.map((card) => ({
      ...card,
      contexts: card.contexts.map((ctx) => ({ ...ctx, sid: item.sid, sig: item.sig })),
    }));
    bucket.cards.push(...enriched);
  }

  if (item.warnings?.length) bucket.warnings.push(...item.warnings);
}

/** Ядро: агрегируем по SID независимо от порядка JSONL и считаем метрики. */
export function aggregateResultsBySid(
  manifest: Manifest,
  batch: BatchResultV1,
): { data: AggregatedBySid; metrics: ProcessingMetrics } {
  const aggregated: AggregatedBySid = new Map();
  for (const it of manifest.items) aggregated.set(it.sid, { ru: [], cards: [], warnings: [] });

  const metrics: ProcessingMetrics = {
    totalSids: manifest.items.length,
    receivedSids: 0,
    missingSids: 0,
    invalidSigs: 0,
    duplicateRussian: 0,
    emptyRussian: 0,
    schemaViolations: 0,
  };

  for (const item of batch.items) applyResultItem(manifest, aggregated, metrics, item);

  aggregated.forEach((b) => {
    if (b.ru.length || b.cards.length) metrics.receivedSids++;
    else metrics.missingSids++;
  });

  return { data: aggregated, metrics };
}

/** Сборка RU строго по порядку SID из манифеста. */
export function buildRussianTextFromAggregation(
  manifest: Manifest,
  aggregated: AggregatedBySid,
  useNewlines: boolean = true,
): string {
  const sep = useNewlines ? '\n' : ' ';
  const out: string[] = [];
  for (const mi of manifest.items) {
    const b = aggregated.get(mi.sid);
    if (!b || b.ru.length === 0) continue;
    out.push(pickCanonicalRussian(b.ru, true));
  }
  return out.join(sep);
}

/** Извлечь все карточки. */
export function extractAllFlashcards(aggregated: AggregatedBySid): Flashcard[] {
  const out: Flashcard[] = [];
  aggregated.forEach((v) => out.push(...v.cards));
  return out;
}
