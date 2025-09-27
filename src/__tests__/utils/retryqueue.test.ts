import { describe, expect, it, vi } from 'vitest';
import { RetryQueue } from '../../utils/retry';

describe('RetryQueue split-retry skeleton', () => {
  it('calls retryOne for every queued SID and routes success/failure', async () => {
    const q = new RetryQueue();
    q.enqueue(0, 'A.', new Error('e0'));
    q.enqueue(1, 'B.', new Error('e1'));

    const retryOne = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('still failed'));
    const ok: number[] = [];
    const bad: number[] = [];
    await q.processQueue(
      'batch-x',
      retryOne,
      (sid) => ok.push(sid),
      (sid) => bad.push(sid),
    );

    expect(retryOne).toHaveBeenCalledTimes(2);
    expect(ok).toEqual([0]);
    expect(bad).toEqual([1]);
  });
});
