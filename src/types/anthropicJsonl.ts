// src/types/anthropicJsonl.ts
import { z } from 'zod';

// Строка результата из Message Batches
export const ZAnthropicJsonlLine = z.object({
  custom_id: z.string().min(1).max(64),
  result: z.object({
    type: z.enum(['succeeded', 'errored', 'canceled', 'expired']),
    message: z.any().optional(),
    error: z.any().optional(),
  }),
});
export type AnthropicJsonlLine = z.infer<typeof ZAnthropicJsonlLine>;
