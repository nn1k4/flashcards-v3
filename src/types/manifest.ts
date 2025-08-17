// src/types/manifest.ts
// Контракты манифеста и базовая проверка инвариантов
import { z } from "zod";
import type { SentenceId, ChunkIndex, BatchId, Signature } from "./core";

// Zod схемы для runtime-валидации (см. Этап 4.2)
export const ZManifestItem = z.object({
  sid: z.number().int().nonnegative(),
  lv: z.string().min(1),
  sig: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
});

export const ZManifest = z.object({
  batchId: z.string().min(1),
  source: z.string().min(1),
  items: z.array(ZManifestItem),
  createdAt: z.string().datetime(),
  version: z.literal("1.0").default("1.0"),
});

// Типы, выведенные из схем
export type ManifestItem = z.infer<typeof ZManifestItem>;
export type Manifest = z.infer<typeof ZManifest>;

// Инварианты манифеста (описаны в плане)
export type ManifestInvariants = {
  sidSequential: boolean;   // SID идут подряд: 0,1,2,...
  signaturesValid: boolean; // sig соответствует правилу генерации
  sourceMatches: boolean;   // source == конкатенация lv (нормализованная)
  noEmptyItems: boolean;    // нет пустых предложений
};

/** Нормализация текста для сигнатуры.
 *  ВНИМАНИЕ: обязательно синхронизировать с normalizeText() в utils/manifest.ts,
 *  когда он появится. Здесь — минимальная версия для базовой проверки.
 */
export function normalizeForSignature(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** Генерация сигнатуры: base64(normalized_lv + "#" + sid)
 *  (см. Специальные инструкции в плане)
 */
export function computeSignature(lv: string, sid: SentenceId): Signature {
  const base = `${normalizeForSignature(lv)}#${sid}`;
  // btoa недоступен в Node окружении тестов — используем Buffer
  return Buffer.from(base, "utf-8").toString("base64");
}

/** Базовая проверка инвариантов манифеста.
 *  Полные проверки/метрики можно расширить в utils/manifest.ts на Этапе 5.
 */
export function computeManifestInvariants(m: Manifest): ManifestInvariants {
  const noEmptyItems = m.items.every((it) => it.lv.trim().length > 0);

  // SID: 0..N без пропусков
  let sidSequential = true;
  for (let i = 0; i < m.items.length; i++) {
    if (m.items[i].sid !== i) {
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
