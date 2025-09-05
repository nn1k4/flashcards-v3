import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError, parseRetryAfter } from '../../api/client';

describe('parseRetryAfter', () => {
  it('parses seconds', () => {
    expect(parseRetryAfter('5')).toBeGreaterThanOrEqual(5000);
  });
  it('parses http-date', () => {
    const dt = new Date(Date.now() + 2000).toUTCString();
    const ms = parseRetryAfter(dt)!;
    expect(ms).toBeGreaterThan(0);
  });
  it('returns null on bad', () => {
    expect(parseRetryAfter('notadate')).toBeNull();
  });
});

describe('getBatchResult Retry-After and status mapping', () => {
  const origFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = origFetch as any;
    vi.restoreAllMocks();
  });

  it('throws BATCH_PROCESSING with retryAfterMs on 202 + Retry-After', async () => {
    const headers = new Headers();
    headers.set('Retry-After', '3');
    (globalThis.fetch as any).mockResolvedValueOnce(new Response('', { status: 202, headers }));
    try {
      await apiClient.getBatchResult('b1');
      expect.unreachable();
    } catch (e) {
      const err = e as ApiError;
      expect(err.code).toBe('BATCH_PROCESSING');
      expect(err.retryAfterMs && err.retryAfterMs >= 3000).toBeTruthy();
    }
  });

  it('maps 410 to EXPIRED', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(new Response('gone', { status: 410 }));
    await expect(apiClient.getBatchResult('b2')).rejects.toMatchObject({ code: 'EXPIRED' });
  });
});
