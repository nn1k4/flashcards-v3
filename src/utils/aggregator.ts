// src/utils/aggregator.ts
// Агрегатор результатов по SID + каноникализация RU + метрики
// ВАЖНО: MANIFEST-FIRST — LV текст и порядок всегда из манифеста.

import type { Manifest } from '../types/manifest';
import type { BatchResultV1, BatchResultItemV1, Flashcard } from '../types/dto';
import type { ProcessingMetrics } from '../types/core';
import { normalizeText } from './splitter';

// Структура накопленных данных по каждому SID
export type AggregatedBySid = Map<number, {
  ru: string[];         // варианты русского перевода для данного SID
  cards: Flashcard[];   // карточки, обогащённые контекстом sid/sig
  warnings: string[];   // предупреждения от LLM
}>;

/**
 * Канонический выбор русского предложения.
 * Идея:
 * - нормализуем и снимаем финальную пунктуацию → ключ
 * - считаем частоты по ключу; при равной частоте берём более длинный оригинал
 * - при необходимости гарантируем финальную точку
 */
export function pickCanonicalRussian(
  variants: string[],
  ensureDot: boolean = true
): string {
  if (variants.length === 0) return '';
  if (variants.length === 1) return ensureEnding(variants[0]!, ensureDot);

  const freq = new Map<string, { count: number; orig: string; len: number }>();
  for (const v of variants) {
    const t = v.trim();
    if (!t) continue;
    const key = normalizeText(t).toLowerCase().replace(/[.!?…]+$/, '');
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
    if (!best || v.count > best.count || (v.count === best.count && v.len > best.len)) {
      best = v;
    }
  }
  return best ? ensureEnding(best.orig, ensureDot) : '';
}

function ensureEnding(text: string, ensureDot: boolean): string {
  if (!ensureDot) return text;
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/**
 * Ядро агрегации: принимаем batch, группируем по SID, считаем метрики.
 * Порядок JSONL НЕ важен — агрегируем в Map по SID и берём LV/порядок из манифеста.
 */
export function aggregateResultsBySid(
  manifest: Manifest,
  batch: BatchResultV1
): { data: AggregatedBySid; metrics: ProcessingMetrics } {
  // Инициализация «пустых» бакетов для каждого SID из манифеста
  const aggregated: AggregatedBySid = new Map();
  for (const it of manifest.items) {
    aggregated.set(it.sid, { ru: [], cards: [], warnings: [] });
  }

  // Инициализация метрик
  const metrics: ProcessingMetrics = {
    totalSids: manifest.items.length,
    receivedSids: 0,
    missingSids: 0,
    invalidSigs: 0,
    duplicateRussian: 0,
    emptyRussian: 0,
    schemaViolations: 0,
  };

  // Обработка результатов из batch
  for (const item of batch.items) {
    applyResultItem(manifest, aggregated, metrics, item);
  }

  // Подсчёт финальных метрик
  aggregated.forEach((data) => {
    if (data.ru.length > 0 || data.cards.length > 0) {
      metrics.receivedSids++;
    } else {
      metrics.missingSids++;
    }
  });

  return { data: aggregated, metrics };
}

/**
 * Обработка одного элемента результата: сигнатуры, RU, карточки, предупреждения.
 * Нарушения схемы/неизвестный SID считаем как schemaViolations.
 */
function applyResultItem(
  manifest: Manifest,
  aggregated: AggregatedBySid,
  metrics: ProcessingMetrics,
  item: BatchResultItemV1
): void {
  const manifestItem = manifest.items[item.sid];

  // Неизвестный SID — нарушение схемы
  if (!manifestItem) {
    metrics.schemaViolations++;
    return;
  }

  // Проверка сигнатуры (не прерывает обработку)
  if (manifestItem.sig !== item.sig) {
    metrics.invalidSigs++;
  }

  const bucket = aggregated.get(item.sid)!;

  // Русский перевод
  if (item.russian !== undefined) {
    const trimmed = item.russian.trim();
    if (!trimmed) {
      metrics.emptyRussian++;
    } else if (bucket.ru.includes(trimmed)) {
      metrics.duplicateRussian++;
    } else {
      bucket.ru.push(trimmed);
    }
  }

  // Карточки — обогащаем контекстами sid/sig
  if (item.cards?.length) {
    const enriched = item.cards.map(card => ({
      ...card,
      contexts: card.contexts.map(ctx => ({
        ...ctx,
        sid: item.sid,
        sig: item.sig,
      })),
    }));
    bucket.cards.push(...enriched);
  }

  // Предупреждения
  if (item.warnings?.length) {
    bucket.warnings.push(...item.warnings);
  }
}

/**
 * Итоговая сборка русского текста строго по порядку SID из манифеста.
 * Отсутствующие переводы пропускаем (не вставляем заглушки).
 */
export function buildRussianTextFromAggregation(
  manifest: Manifest,
  aggregated: AggregatedBySid,
  useNewlines: boolean = true
): string {
  const sep = useNewlines ? '\n' : ' ';
  const parts: string[] = [];

  for (const mi of manifest.items) {
    const b = aggregated.get(mi.sid);
    if (!b || b.ru.length === 0) continue;
    parts.push(pickCanonicalRussian(b.ru, true));
  }

  return parts.join(sep);
}

/** Извлечение всех карточек из агрегированных данных. */
export function extractAllFlashcards(aggregated: AggregatedBySid): Flashcard[] {
  const out: Flashcard[] = [];
  aggregated.forEach((v) => { out.push(...v.cards); });
  return out;
}

/** Диагностическая статистика по агрегированному набору. */
export function getAggregationStats(aggregated: AggregatedBySid): {
  totalSids: number;
  sidsWithRussian: number;
  sidsWithCards: number;
  totalCards: number;
  totalWarnings: number;
} {
  let sidsWithRussian = 0;
  let sidsWithCards = 0;
  let totalCards = 0;
  let totalWarnings = 0;

  aggregated.forEach((v) => {
    if (v.ru.length) sidsWithRussian++;
    if (v.cards.length) sidsWithCards++;
    totalCards += v.cards.length;
    totalWarnings += v.warnings.length;
  });

  return {
    totalSids: aggregated.size,
    sidsWithRussian,
    sidsWithCards,
    totalCards,
    totalWarnings,
  };
}
