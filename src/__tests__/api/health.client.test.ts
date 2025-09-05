import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';

describe('apiClient.getHealth', () => {
  const origFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = origFetch as any;
    vi.restoreAllMocks();
  });

  it('returns ok on 200', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = await apiClient.getHealth();
    expect(res.ok).toBe(true);
  });

  it('maps 502 to PROXY_DOWN', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(new Response('bad', { status: 502 }));
    await expect(apiClient.getHealth()).rejects.toMatchObject({ code: 'SERVER_ERROR' });
  });

  it('maps network error to NETWORK_ERROR', async () => {
    (globalThis.fetch as any).mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(apiClient.getHealth()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
