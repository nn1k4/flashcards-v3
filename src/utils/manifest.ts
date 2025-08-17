// src/utils/manifest.ts
// Генерация/валидация манифеста и служебные функции
import { v4 as uuidv4 } from 'uuid';
import type { Manifest, ManifestItem, ManifestInvariants } from '../types/manifest';
import { ZManifest } from '../types/manifest';
import {
  splitIntoSentencesDeterministic,
  validateSplitterInvariant,
  createSignature,
  normalizeText,
} from './splitter';

/**
 * Создаёт манифест — ЕДИНСТВЕННЫЙ источник истины для порядка предложений.
 * SID — последовательные номера [0..n-1], chunkIndex считается по maxSentencesPerChunk.
 */
export function buildManifest(
  sourceText: string,
  maxSentencesPerChunk: number = 20
): Manifest {
  const batchId = uuidv4();
  const sentences = splitIntoSentencesDeterministic(sourceText);

  // Критическая проверка: rejoin инвариант
  validateSplitterInvariant(sourceText, sentences);

  let chunkIndex = 0;
  let inChunk = 0;

  const items: ManifestItem[] = sentences.map((lv, sid) => {
    if (inChunk >= maxSentencesPerChunk) {
      chunkIndex++;
      inChunk = 0;
    }
    inChunk++;
    return {
      sid,
      lv,
      sig: createSignature(lv, sid),
      chunkIndex,
    };
  });

  const manifest: Manifest = {
    batchId,
    source: sourceText,
    items,
    createdAt: new Date().toISOString(),
    version: '1.0',
  };

  // Финальная валидация манифеста
  validateManifest(manifest);

  return manifest;
}

/** Восстановление LV-текста ТОЛЬКО из манифеста. */
export function buildLvTextFromManifest(manifest: Manifest, useNewlines: boolean = true): string {
  const sep = useNewlines ? '\n' : ' ';
  return manifest.items.map(i => i.lv).join(sep);
}

/** Группировка элементов манифеста по чанкам для отправки в LLM. */
export function getManifestChunks(
  manifest: Manifest
): Array<{ chunkIndex: number; items: ManifestItem[] }> {
  const byChunk = new Map<number, ManifestItem[]>();
  manifest.items.forEach(it => {
    if (!byChunk.has(it.chunkIndex)) byChunk.set(it.chunkIndex, []);
    byChunk.get(it.chunkIndex)!.push(it);
  });
  return Array.from(byChunk.entries())
    .map(([chunkIndex, items]) => ({ chunkIndex, items }))
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

/**
 * Полная валидация инвариантов манифеста.
 * Бросает ошибку при нарушении, возвращает флаги для диагностики.
 */
export function validateManifest(manifest: Manifest): ManifestInvariants {
  // 1) Zod-схема
  const parsed = ZManifest.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(`Invalid manifest schema: ${parsed.error.message}`);
  }

  const invariants: ManifestInvariants = {
    sidSequential: true,
    signaturesValid: true,
    sourceMatches: true,
    noEmptyItems: true,
  };

  // 2) SID: 0..n-1 и уникальны
  const sids = manifest.items.map(i => i.sid);
  const expected = Array.from({ length: sids.length }, (_, i) => i);
  if (JSON.stringify(sids) !== JSON.stringify(expected)) {
    invariants.sidSequential = false;
    throw new Error('Manifest invariant violated: SID sequence is not sequential');
  }
  if (new Set(sids).size !== sids.length) {
    throw new Error('Manifest invariant violated: duplicate SIDs found');
  }

  // 3) Сигнатуры соответствуют тексту
  manifest.items.forEach(item => {
    const expectedSig = createSignature(item.lv, item.sid);
    if (item.sig !== expectedSig) {
      invariants.signaturesValid = false;
      throw new Error(`Manifest invariant violated: invalid signature for SID ${item.sid}`);
    }
  });

  // 4) source соответствует конкатенации lv
  const rebuilt = manifest.items.map(i => i.lv).join(' ');
  if (normalizeText(rebuilt) !== normalizeText(manifest.source)) {
    invariants.sourceMatches = false;
    throw new Error('Manifest invariant violated: source text does not match items');
  }

  // 5) Нет пустых lv
  if (manifest.items.some(i => !i.lv.trim())) {
    invariants.noEmptyItems = false;
    throw new Error('Manifest invariant violated: empty items found');
  }

  return invariants;
}

/** Статистика манифеста для UI/диагностики. */
export function getManifestStats(manifest: Manifest): {
  totalSentences: number;
  totalChunks: number;
  avgSentencesPerChunk: number;
  maxChunkSize: number;
} {
  const totalSentences = manifest.items.length;
  const chunkIds = new Set(manifest.items.map(i => i.chunkIndex));
  const totalChunks = chunkIds.size;
  const sizes = Array.from(chunkIds).map(ci => manifest.items.filter(i => i.chunkIndex === ci).length);

  return {
    totalSentences,
    totalChunks,
    avgSentencesPerChunk: totalChunks ? totalSentences / totalChunks : 0,
    maxChunkSize: sizes.length ? Math.max(...sizes) : 0,
  };
}
