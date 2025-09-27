import { useMemo } from 'react';
import type { ZodType } from 'zod';
import { LLMAdapter, type MessagesRequest, type MessagesResponse } from '../adapters/LLMAdapter';
import {
  EMITTER_TOOL_NAME,
  ZEmitFlashcardsInput,
  type EmitFlashcardsInput,
} from '../types/tool_use';

export type ToolCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; stopReason?: 'max_tokens' | 'tool_use' | 'end_turn' | 'unknown'; error?: Error };

export function useLLMToolsEmitter<T = EmitFlashcardsInput>(deps?: {
  callMessages?: (req: MessagesRequest) => Promise<MessagesResponse>;
  schema?: ZodType<T>;
  toolName?: string;
}) {
  const adapter = useMemo(() => {
    const callMessages =
      deps?.callMessages ??
      (async () => {
        throw new Error('LLM call not wired: provide callMessages in deps');
      });
    return new LLMAdapter({ callMessages });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schema = (deps?.schema as ZodType<T>) ?? (ZEmitFlashcardsInput as unknown as ZodType<T>);
  const toolName = deps?.toolName ?? EMITTER_TOOL_NAME;

  return {
    async invoke(input: MessagesRequest): Promise<ToolCallResult<T>> {
      return adapter.invokeWithSchema<T>(input, schema, toolName);
    },
  };
}
