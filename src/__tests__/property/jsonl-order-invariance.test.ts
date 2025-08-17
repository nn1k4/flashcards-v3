// src/__tests__/property/jsonl-order-invariance.test.ts
// Инвариант: порядок JSON-результатов не влияет на реконструкцию LV (агрегация по SID)

import fc from 'fast-check';
import type { BatchResultV1 } from '../../types/dto';
import type { Manifest } from '../../types/manifest';
import { aggregateResultsBySid } from '../../utils/aggregator';
import { buildManifest } from '../../utils/manifest';
import { normalizeText } from '../../utils/splitter';

it('RU/LV сборка инвариантна к перестановкам результатов', () => {
  fc.assert(
    fc.property(
      // Генерируем 1..6 предложений длиной 5..60 символов, добавляем точку
      fc.array(
        fc.string({ minLength: 5, maxLength: 60 }).map((s) => s.trim() + '.'),
        {
          minLength: 1,
          maxLength: 6,
        },
      ),
      (sentences) => {
        // 1) Исходный LV-текст и манифест
        const source = sentences.join(' ');
        const manifest = buildManifest(source) as Manifest;
        const originalLv = normalizeText(source);

        // 2) Формируем синтетический результат по каждому SID
        const itemsShuffled = [...manifest.items]
          .sort(() => Math.random() - 0.5) // порядок произвольный
          .map((it) => ({
            sid: it.sid,
            sig: it.sig,
            russian: `RU ${it.sid}`,
          }));

        const batch: BatchResultV1 = {
          schemaVersion: 1,
          batchId: manifest.batchId,
          items: itemsShuffled,
        };

        // 3) Агрегация строго по SID — порядок элементов значения не имеет
        aggregateResultsBySid(manifest, batch);

        // 4) Реконструкция LV из манифеста должна совпасть с нормализованным исходником
        const reconstructedLv = normalizeText(
          manifest.items.map((item: (typeof manifest.items)[number]) => item.lv).join(' '),
        );
        expect(reconstructedLv).toBe(originalLv);
      },
    ),
    { numRuns: 40 },
  );
});
