// src/utils/aggregator.ts
// Агрегация результатов JSONL по SID независимо от порядка прихода
import type { Manifest } from '../types/manifest';
import type { BatchResultV1, Flashcard } from '../types/dto';
import type { ProcessingMetrics } from '../types/core';
import { normalizeText } from './splitter';

export type AggregatedBySid = Map<
  number,
  {
    ru: string[];
    cards: Flashcard[];
    warnings: string[];
  }
>;

/** Канонизация русских вариантов по частоте и длине (без учёта финальной пунктуации). */
export function pickCanonicalRussian(variants: string[], ensureDot: boolean = true): string {
  if (variants.length === 0) return '';
  if (variants.length === 1) return ensureDotIfNeeded(variants[0]!, ensureDot);

  const freq = new Map<string, { count: number; original: string; length: number }>();
  for (const v of variants) {
    const trimmed = v.trim();
    if (!trimmed) continue;

    const key = normalizeText(trimmed).toLowerCase().replace(/[.!?…]+$/, '');
    if (!key) continue;

    const ex = freq.get(key);
    if (ex) {
      ex.count++;
      if (trimmed.length > ex.length) {
        ex.original = trimmed;
        ex.length = trimmed.length;
      }
    } else {
      freq.set(key, { count: 1, original: trimmed, length: trimmed.length });
    }
  }

  // Лучший — с наибольшей частотой, при равенстве — длиннее
  let best: { count: number; original: string; length: number } | null = null;
  for (const v of freq.values()) {
    if (!best || v.count > best.count || (v.count === best.count && v.length > best.length)) {
      best = v;
    }
  }
  return best ? ensureDotIfNeeded(best.original, ensureDot) : '';
}

function ensureDotIfNeeded(text: string, ensureDot: boolean): string {
  if (!ensureDot || !text) return text;
  return /[.!?…]$/.test(text) ? text : text + '.';
}

/**
 * Агрегация результатов по SID — КЛЮЧЕВАЯ функция архитектуры.
 * Возвращает агрегированные данные и метрики качества/целостности.
 */
export function aggregateResultsBySid(
  manifest: Manifest,
  batchResult: BatchResultV1
): { data: AggregatedBySid; metrics: ProcessingMetrics } {
  const aggregated: AggregatedBySid = new Map();
  const metrics: ProcessingMetrics = {
    totalSids: manifest.items.length,
    receivedSids: 0,
    missingSids: 0,
    invalidSigs: 0,
    duplicateRussian: 0,
    emptyRussian: 0,
    schemaViolations: 0,
  };

  // Инициализировать все SID (даже те, что не пришли)
  manifest.items.forEach(mi => {
    aggregated.set(mi.sid, { ru: [], cards: [], warnings: [] });
  });

  // Складываем пришедшие элементы (порядок не важен)
  batchResult.items.forEach(ri => {
    const mi = manifest.items[ri.sid];
    if (!mi) {
      // неизвестный SID — нарушение контракта
      metrics.schemaViolations++;
      return;
    }

    // Сигнатура
    if (mi.sig !== ri.sig) {
      metrics.invalidSigs++;
    }

    const bucket = aggregated.get(ri.sid)!;

    // Русский перевод
    if (typeof ri.russian === 'string') {
      const ru = ri.russian.trim();
      if (ru) {
        if (bucket.ru.includes(ru)) metrics.duplicateRussian++;
        else bucket.ru.push(ru);
      } else {
        metrics.emptyRussian++;
      }
    }

    // Карточки
    if (Array.isArray(ri.cards) && ri.cards.length) {
      const enriched = ri.cards.map(c => ({
        ...c,
        contexts: (c.contexts || []).map(ctx => ({
          ...ctx,
          // добавляем атрибуты привязки к предложению
          sid: ri.sid,
          sig: ri.sig,
        })),
      }));
      bucket.cards.push(...enriched);
    }
  });

  // Подсчёт полученных/пропущенных
  metrics.receivedSids = Array.from(aggregated.entries()).reduce(
    (acc, [, v]) => acc + (v.ru.length > 0 || v.cards.length > 0 ? 1 : 0),
    0
  );
  metrics.missingSids = metrics.totalSids - metrics.receivedSids;

  return { data: aggregated, metrics };
}

/** Сборка RU-текста по порядку SID из манифеста. */
export function buildRussianTextFromAggregation(
  manifest: Manifest,
  aggregated: AggregatedBySid,
  useNewlines: boolean = true
): string {
  const sep = useNewlines ? '\n' : ' ';
  const lines = manifest.items
    .map(mi => pickCanonicalRussian(aggregated.get(mi.sid)?.ru || [], true))
    .filter(Boolean);
  return lines.join(sep);
}

/** Все флэшкарты из агрегированных данных. */
export function extractAllFlashcards(aggregated: AggregatedBySid): Flashcard[] {
  const out: Flashcard[] = [];
  aggregated.forEach(v => {
    out.push(...v.cards);
  });
  return out;
}

/** Вспомогательная статистика по агрегации. */
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

  aggregated.forEach(v => {
    if (v.ru.length > 0) sidsWithRussian++;
    if (v.cards.length > 0) sidsWithCards++;
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
