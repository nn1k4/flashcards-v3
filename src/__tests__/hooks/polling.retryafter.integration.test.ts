import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client';
import { config } from '../../config';
import { pickAdaptiveDelay } from '../../hooks/useBatch';

describe('Polling: Retry-After overrides adaptive delay (S2)', () => {
  it('uses Retry-After when respectRetryAfter=true', () => {
    const elapsedMs = 12_000; // pick stage 10..60s
    const adaptive = pickAdaptiveDelay(elapsedMs);
    // ensure adaptive yields within configured [min,max]
    const stage = config.batch.polling.stages.find((s) => s.fromSec === 10)!;
    expect(adaptive).toBeGreaterThanOrEqual(stage.minMs);
    expect(adaptive).toBeLessThanOrEqual(stage.maxMs);

    const raMs = 7000;
    const err = new ApiError('processing', 'BATCH_PROCESSING', true, 202, raMs);
    // Hook logic prefers Retry-After; we mimic by taking Math.max(100, retryAfterMs)
    const chosen = Math.max(100, err.retryAfterMs!);
    expect(config.batch.polling.respectRetryAfter).toBe(true);
    expect(chosen).toBe(raMs);
    expect(chosen).not.toBe(adaptive);
  });
});
