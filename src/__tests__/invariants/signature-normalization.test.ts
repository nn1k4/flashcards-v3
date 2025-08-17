// src/__tests__/invariants/signature-normalization.test.ts
import fc from 'fast-check';
import { computeSignature, normalizeForSignature } from '../../types/manifest';
import { createSignature, normalizeText } from '../../utils/splitter';

describe('Signature invariant: manifest vs splitter', () => {
  it('normalizeForSignature(text) === normalizeText(text)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeForSignature(s)).toBe(normalizeText(s));
      }),
      { numRuns: 200 },
    );
  });

  it('computeSignature(lv, sid) === createSignature(lv, sid)', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 0, max: 1_000_000 }), (lv, sid) => {
        expect(computeSignature(lv, sid)).toBe(createSignature(lv, sid));
      }),
      { numRuns: 200 },
    );
  });
});
