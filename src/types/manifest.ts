// src/types/manifest.ts
// Контракты манифеста и базовая проверка инвариантов (Zod + TS)
// ВАЖНО: нормализация для подписи должна совпадать с utils/splitter.normalizeText

import { z } from 'zod';
import type { SentenceId, Signature } from './core';

// ------------------------------------
// Константы версии и Zod-схемы
// ------------------------------------
export const MANIFEST_VERSION = '1.0' as const;

/** Элемент манифеста (одно LV-предложение). */
export const ZManifestItem = z.object({
  sid: z.number().int().nonnegative(),
  lv: z.string().min(1),
  sig: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
});

/** Корневой манифест. Генерируется один раз на входной текст. */
export const ZManifest = z.object({
  batchId: z.string().min(1),
  source: z.string().min(1),
  items: z.array(ZManifestItem).min(1),
  createdAt: z.string().datetime(),
  version: z.literal(MANIFEST_VERSION).default(MANIFEST_VERSION),
});

// ------------------------------------
// Типы, выведенные из схем
// ------------------------------------
export type ManifestItem = z.infer<typeof ZManifestItem>;
export type Manifest = z.infer<typeof ZManifest>;

// ------------------------------------
// Инварианты манифеста (для диагностики)
// ------------------------------------
export type ManifestInvariants = {
  /** SID идут строго подряд: 0,1,2,... без пропусков/повторов */
  sidSequential: boolean;
  /** sig соответствует правилу генерации computeSignature(lv, sid) */
  signaturesValid: boolean;
  /** source нормализованно равен конкатенации items.lv */
  sourceMatches: boolean;
  /** нет пустых предложений */
  noEmptyItems: boolean;
};

// ------------------------------------
// Утилиты нормализации/подписей
// ------------------------------------

/**
 * Нормализация текста для формирования подписи и сравнения:
 * - перевод строк → пробел
 * - сжатие повторных пробелов
 * - trim() по краям
 * СИНХРОНИЗИРОВАТЬ с utils/splitter.normalizeText.
 */
export function normalizeForSignature(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Кросс-платформенный base64 для Unicode строк. */
function toBase64(str: string): string {
  // Браузерный путь
  if (typeof (globalThis as any).btoa === 'function') {
    // Корректная UTF-8 упаковка для btoa
    // eslint-disable-next-line no-undef
    return (globalThis as any).btoa(unescape(encodeURIComponent(str)));
  }
  // Node.js путь
  const Buf: any = (globalThis as any).Buffer;
  if (Buf && typeof Buf.from === 'function') {
    return Buf.from(str, 'utf-8').toString('base64');
  }
  throw new Error('No base64 encoder available in current runtime');
}

/**
 * Генерация сигнатуры предложения.
 * По плану: base64(normalized_lv + "#" + sid)
 * Сигнатура ДОЛЖНА быть детерминированной и совпадать в любых средах.
 */
export function computeSignature(lv: string, sid: SentenceId): Signature {
  const base = `${normalizeForSignature(lv)}#${sid}`;
  return toBase64(base);
}

// ------------------------------------
// Базовая проверка инвариантов манифеста
// (полные проверки/метрики — в src/utils/manifest.ts на Этапе 5)
// ------------------------------------

/**
 * Минимальная проверка инвариантов:
 * - SID последовательны (0..N-1)
 * - sig валидны для каждого пункта
 * - source нормализованно равен конкатенации items.lv
 * - отсутствуют пустые предложения
 *
 * НЕ модифицирует входные данные, только вычисляет флаги.
 */
export function computeManifestInvariants(m: Manifest): ManifestInvariants {
  // 1) Нет пустых lv
  const noEmptyItems = m.items.every((it) => it.lv.trim().length > 0);

  // 2) Последовательность SID: 0..N-1 без пропусков
  let sidSequential = true;
  for (let i = 0; i < m.items.length; i++) {
    if (m.items[i]!.sid !== i) {
      sidSequential = false;
      break;
    }
  }

  // 3) Подписи соответствуют правилу
  const signaturesValid = m.items.every((it) => it.sig === computeSignature(it.lv, it.sid));

  // 4) source соответствует конкатенации lv (после нормализации)
  const normalizedSource = normalizeForSignature(m.source);
  const normalizedJoin = normalizeForSignature(m.items.map((it) => it.lv).join(' '));
  const sourceMatches = normalizedSource === normalizedJoin;

  return { sidSequential, signaturesValid, sourceMatches, noEmptyItems };
}
