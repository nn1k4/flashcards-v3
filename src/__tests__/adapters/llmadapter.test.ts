import { describe, expect, it } from 'vitest';
import {
  LLMAdapter,
  extractFirstToolInput,
  type MessagesRequest,
  type MessagesResponse,
} from '../../adapters/LLMAdapter';
import { EMITTER_TOOL_NAME, ZEmitFlashcardsInput } from '../../types/tool_use';

describe('LLMAdapter', () => {
  it('extractFirstToolInput finds the first emit_flashcards block', () => {
    const content = [
      { type: 'text', text: 'x' },
      { type: 'tool_use', name: EMITTER_TOOL_NAME, input: { flashcards: [] } as any },
    ] as any;
    const in1 = extractFirstToolInput(content, EMITTER_TOOL_NAME);
    expect(in1).toBeDefined();
  });

  it('invokeWithSchema validates tool_use.input against Zod schema', async () => {
    const adapter = new LLMAdapter({
      callMessages: async (_req: MessagesRequest): Promise<MessagesResponse> => ({
        content: [
          {
            type: 'tool_use',
            name: EMITTER_TOOL_NAME,
            input: {
              flashcards: [
                {
                  unit: 'word',
                  base_form: 'Sveiki',
                  contexts: [{ lv: 'Sveiki!', ru: 'Здравствуйте!' }],
                  visible: true,
                },
              ],
            },
          },
        ] as any,
        stop_reason: 'tool_use',
      }),
    });

    const res = await adapter.invokeWithSchema(
      {
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' } as any],
        tools: [],
        tool_choice: { type: 'tool', name: EMITTER_TOOL_NAME },
        disable_parallel_tool_use: true,
      },
      ZEmitFlashcardsInput,
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.flashcards?.length).toBe(1);
    }
  });

  it('returns stopReason when no tool_use, but stop_reason present', async () => {
    const adapter = new LLMAdapter({
      callMessages: async () => ({ content: [], stop_reason: 'max_tokens' }),
    });
    const res2 = await adapter.invokeWithSchema(
      {
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'x' } as any],
        tools: [],
        tool_choice: { type: 'tool', name: EMITTER_TOOL_NAME },
      },
      ZEmitFlashcardsInput,
    );
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.stopReason).toBe('max_tokens');
    }
  });
});
