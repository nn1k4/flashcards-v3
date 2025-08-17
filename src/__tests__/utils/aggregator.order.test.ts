import { describe, expect, it } from 'vitest';
import type { BatchResultV1 } from '../../types/dto';
import { aggregateResultsBySid, buildRussianTextFromAggregation } from '../../utils/aggregator';
import { buildManifest } from '../../utils/manifest';

describe('Aggregator — order invariants', () => {
  it('RU следует порядку SID из манифеста независимо от JSONL', () => {
    const manifest = buildManifest('First. Second. Third.', 99);
    const batch: BatchResultV1 = {
      schemaVersion: 1,
      batchId: manifest.batchId,
      items: [
        { sid: 2, sig: manifest.items[2]!.sig, russian: 'Третий.' },
        { sid: 0, sig: manifest.items[0]!.sig, russian: 'Первый.' },
        { sid: 1, sig: manifest.items[1]!.sig, russian: 'Второй.' },
      ],
    };
    const { data, metrics } = aggregateResultsBySid(manifest, batch);
    const ru = buildRussianTextFromAggregation(manifest, data, true);

    expect(metrics.invalidSigs).toBe(0);
    expect(ru).toBe(['Первый.', 'Второй.', 'Третий.'].join('\n'));
  });
});
