import { z } from 'zod';

export const ZLlmConfig = z.object({
  defaultModel: z.string().min(1),
  maxTokensDefault: z.number().int().positive(),
  toolChoice: z.string().min(1),
  promptCaching: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
});
export type LlmConfig = z.infer<typeof ZLlmConfig>;
