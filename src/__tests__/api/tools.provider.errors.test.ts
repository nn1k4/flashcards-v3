import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessagesRequest } from '../../adapters/LLMAdapter';
import { callMessagesViaProxy } from '../../api/tools';
import { config as appConfig } from '../../config';

describe('callMessagesViaProxy provider error mapping', () => {
  const origFetch = globalThis.fetch;
  const origUseProvider = appConfig.llm.useProvider;

  beforeEach(() => {
    // Force provider path for this test
    (appConfig as any).llm.useProvider = true;
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    (appConfig as any).llm.useProvider = origUseProvider;
    globalThis.fetch = origFetch as any;
    vi.restoreAllMocks();
  });

  it('throws Error with provider message when HTTP not ok', async () => {
    const body = JSON.stringify({
      type: 'error',
      error: { type: 'authentication_error', message: 'invalid api key' },
    });
    (globalThis.fetch as any).mockResolvedValueOnce(
      new Response(body, { status: 401, headers: { 'Content-Type': 'application/json' } }),
    );

    const req = {
      model: 'm',
      system: { type: 'text', text: 's' },
      messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }],
      tools: [],
      tool_choice: { type: 'tool', name: 'emit_flashcards' },
    } as unknown as MessagesRequest;

    await expect(callMessagesViaProxy(req)).rejects.toThrow(
      /Provider error 401: .*invalid api key/i,
    );
  });
});
