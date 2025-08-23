import { z } from 'zod';

export const ZBatchConfig = z.object({
  polling: z.object({
    stages: z
      .array(
        z.object({
          fromSec: z.number().nonnegative(),
          minMs: z.number().positive(),
          maxMs: z.number().positive(),
        }),
      )
      .min(1),
    respectRetryAfter: z.boolean().default(true),
  }),
});
export type BatchConfig = z.infer<typeof ZBatchConfig>;
