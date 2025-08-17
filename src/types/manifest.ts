// src/types/manifest.ts
// Контракты манифеста и базовая проверка инвариантов

import { z } from "zod";
import type { SentenceId, Signature } from "./core";

// -----------------------------
// Zod-схемы (runtime-валидация)
// -----------------------------
export const ZManifestItem = z.object({
  sid: z.number().int().nonnegative(),
  lv: z.string().min(1),
  sig: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
});

export const ZManifest = z.object({
  batchId: z.string().min(1),
  source: z.string().min(1),
  items: z.array(ZManifestItem).min(1),
  createdAt: z.string().datetime(),
  version: z.literal("1.0").default("1.0"),
});

// -----------------------------
// Типы, выведенные из схем
// -----------------------------
export type ManifestItem = z.infer<typeof ZManifestItem>;
export type Manifest = z.infer<typeof ZManifest>;

// -----------------------------
// Инварианты манифеста
// -----------------------------
export type ManifestInvariants = {
  sidSequential: boolean;   // SID идут подряд: 0,1,2,...
  signaturesValid: boolean; // sig соответствует правилу генерации
  sourceMatches: boolean;   // source == конкатенация lv (нормализованная)
  noEmptyItems: boolean;    // нет пустых предложений
};

// -----------------------------
// Вспомогательные утилиты
// -----------------------------
/** Нормализация текста для сигнатуры.
 *  ВАЖНО: синхронизировать с normalizeText() в utils/manifest.ts,
 *  когда появится реализация генератора манифеста.
 */
export function normalizeForSignature(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Кросс-платформенный base64: браузер (btoa) → Node (Buffer) → throw */
function toBase64(str: string): string {
  if (typeof globalThis.btoa === "function") {
    // Корректная UTF-8 упаковка для браузерного btoa
    return globalThis.btoa(unescape(encodeURIComponent(str)));
  }
  const B: any = (globalThis as any).Buffer;
  if (B && typeof B.from === "function") {
    return B.from(str, "utf-8").toString("base64");
  }
  throw new Error("No base64 encoder available");
}

/** Генерация сигнатуры: base64(normalized_lv + "#" + sid) */
export function computeSignature(lv: string, sid: SentenceId): Signature {
  const base = `${normalizeForSignature(lv)}#${sid}`;
  return toBase64(base);
}

// -----------------------------
// Проверка инвариантов
// -----------------------------
/** Базовая проверка инвариантов манифеста.
 *  Полные проверки/метрики будут расширены в utils/manifest.ts (Этап 5).
 */
export function computeManifestInvariants(m: Manifest): ManifestInvariants {
  const noEmptyItems = m.items.every((it) => it.lv.trim().length > 0);

  // SID: 0..N без пропусков
  let sidSequential = true;
  for (let i = 0; i < m.items.length; i++) {
    const it = m.items[i]!;
    if (it.sid !== i) {
      sidSequential = false;
      break;
    }
  }

  // sig соответствует правилу (минимальная проверка)
  const signaturesValid = m.items.every(
    (it) => it.sig === computeSignature(it.lv, it.sid)
  );

  // source == конкатенация lv (нормализованная)
  const normalizedSource = normalizeForSignature(m.source);
  const normalizedJoin = normalizeForSignature(
    m.items.map((it) => it.lv).join(" ")
  );
  const sourceMatches = normalizedSource === normalizedJoin;

  return { sidSequential, signaturesValid, sourceMatches, noEmptyItems };
}
