import { describe, expect, it } from 'vitest';
import { ZBatchResultV1 } from '../../types/dto';

describe('DTO contracts (V1)', () => {
  it('parses minimal valid result', () => {
    const payload = {
      schemaVersion: 1,
      batchId: 'batch-1',
      items: [{ sid: 0, sig: 'abc', russian: 'Привет' }],
    };
    const parsed = ZBatchResultV1.parse(payload);
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.items[0]!.sid).toBe(0);
    expect(parsed.batchId).toBe('batch-1');
  });

  it('rejects when schemaVersion is wrong', () => {
    const bad = {
      schemaVersion: 2, // not 1
      batchId: 'batch-1',
      items: [],
    };
    expect(() => ZBatchResultV1.parse(bad)).toThrow();
  });
});
