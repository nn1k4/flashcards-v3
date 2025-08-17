import { describe, it, expect } from 'vitest';
import { buildManifest } from '../../utils/manifest';
import { aggregateResultsBySid } from '../../utils/aggregator';
import type { BatchResultV1 } from '../../types/dto';

describe('Aggregator — metrics', () => {
  it('считает duplicate/empty/invalidSig/missing корректно', () => {
    const manifest = buildManifest('One. Two.', 99);
    const batch: BatchResultV1 = {
      schemaVersion: 1,
      batchId: manifest.batchId,
      items: [
       { sid: 0, sig: manifest.items[0]!.sig, russian: 'Один.' },
       { sid: 0, sig: manifest.items[0]!.sig, russian: 'Один.' }, // duplicate
       { sid: 0, sig: manifest.items[0]!.sig, russian: '  ' },    // empty
        { sid: 1, sig: 'WRONG_SIG', russian: 'Два.' },            // invalidSig
      ],
    };
    const { metrics } = aggregateResultsBySid(manifest, batch);
    expect(metrics.totalSids).toBe(2);
    expect(metrics.duplicateRussian).toBe(1);
    expect(metrics.emptyRussian).toBe(1);
    expect(metrics.invalidSigs).toBe(1);
    expect(metrics.receivedSids).toBe(2);
    expect(metrics.missingSids).toBe(0);
    expect(metrics.schemaViolations).toBe(0);
  });
});
