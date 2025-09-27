import { z } from 'zod';
import {
  EMITTER_TOOL_NAME,
  ZEmitFlashcardsInput,
  type EmitFlashcardsInput,
} from '../types/tool_use';

// Minimal message types for dependency-injected call
export type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: unknown };

export type MessagesRequest = {
  model: string;
  system: string | { type: 'text'; text: string };
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: Array<MessageBlock> | string }>;
  tools: unknown[]; // tool definitions
  tool_choice: { type: 'tool'; name: string } | 'auto';
  disable_parallel_tool_use?: boolean;
  max_tokens?: number;
};

export type MessagesResponse = {
  content: MessageBlock[];
  stop_reason?: 'max_tokens' | 'tool_use' | 'end_turn' | string | null;
};

export type ToolCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; stopReason?: 'max_tokens' | 'tool_use' | 'end_turn' | 'unknown'; error?: Error };

export function extractFirstToolInput(
  content: MessageBlock[],
  toolName: string = EMITTER_TOOL_NAME,
): unknown | undefined {
  for (const b of content || []) {
    if (b && b.type === 'tool_use' && (b as any).name === toolName) return (b as any).input;
  }
  return undefined;
}

export class LLMAdapter {
  private callMessages: (req: MessagesRequest) => Promise<MessagesResponse>;

  constructor(deps: { callMessages: (req: MessagesRequest) => Promise<MessagesResponse> }) {
    this.callMessages = deps.callMessages;
  }

  async invokeEmitFlashcards(req: MessagesRequest): Promise<ToolCallResult<EmitFlashcardsInput>> {
    try {
      const resp = await this.callMessages(req);
      const input = extractFirstToolInput(resp.content, EMITTER_TOOL_NAME);
      if (input !== undefined) {
        const data = ZEmitFlashcardsInput.parse(input);
        return { ok: true, data };
      }
      const sr = (resp.stop_reason as any) ?? 'unknown';
      if (sr === 'max_tokens' || sr === 'tool_use' || sr === 'end_turn') {
        return { ok: false, stopReason: sr };
      }
      return { ok: false, stopReason: 'unknown', error: new Error('No tool_use block found') };
    } catch (e) {
      return { ok: false, stopReason: 'unknown', error: e as Error };
    }
  }

  async invokeWithSchema<T>(
    req: MessagesRequest,
    schema: z.ZodType<T>,
    toolName: string = EMITTER_TOOL_NAME,
  ): Promise<ToolCallResult<T>> {
    try {
      const resp = await this.callMessages(req);
      const input = extractFirstToolInput(resp.content, toolName);
      if (input !== undefined) {
        const data = schema.parse(input);
        return { ok: true, data };
      }
      const sr = (resp.stop_reason as any) ?? 'unknown';
      if (sr === 'max_tokens' || sr === 'tool_use' || sr === 'end_turn') {
        return { ok: false, stopReason: sr };
      }
      return { ok: false, stopReason: 'unknown', error: new Error('No tool_use block found') };
    } catch (e) {
      return { ok: false, stopReason: 'unknown', error: e as Error };
    }
  }
}
