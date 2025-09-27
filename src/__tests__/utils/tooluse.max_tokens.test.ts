import { describe, expect, it, vi } from 'vitest';
import type { MessagesRequest, ToolCallResult } from '../../adapters/LLMAdapter';
import { invokeWithMaxTokensBump } from '../../utils/tooluse';

describe('tool-use: max_tokens bump policy', () => {
  it('retries on max_tokens and increases max_tokens', async () => {
    const calls: MessagesRequest[] = [];
    const invoker = vi
      .fn<(req: MessagesRequest) => Promise<ToolCallResult<{ ok: true }>>>()
      // first: max_tokens stop
      .mockImplementationOnce(async (req) => {
        calls.push(req);
        return { ok: false, stopReason: 'max_tokens' } as any;
      })
      // second: success
      .mockImplementationOnce(async (req) => {
        calls.push(req);
        return { ok: true, data: { ok: true } } as any;
      });

    const baseReq = {
      model: 'm',
      system: { type: 'text', text: 's' },
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      tools: [],
      tool_choice: { type: 'tool', name: 'emit_flashcards' },
      disable_parallel_tool_use: true,
      max_tokens: 512,
    } as unknown as MessagesRequest;

    const res = await invokeWithMaxTokensBump(invoker as any, baseReq, { attempts: 2 });
    expect(res.ok).toBe(true);
    expect(calls.length).toBe(2);
    const first = calls[0]!;
    const second = calls[1]!;
    expect((first as any).max_tokens).toBe(512);
    expect((second as any).max_tokens).toBeGreaterThan(512);
  });
});
