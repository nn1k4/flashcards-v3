import { z } from 'zod';

export const ZLlmConfig = z.object({
  defaultModel: z.string().min(1),
  maxTokensDefault: z.number().int().positive(),
  toolChoice: z.string().min(1),
  // Feature flag: when true, client will call provider-prefixed routes on the proxy
  useProvider: z.boolean().default(false),
  promptCaching: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
});
export type LlmConfig = z.infer<typeof ZLlmConfig>;
