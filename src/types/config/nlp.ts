import { z } from 'zod';

export const ZNlpConfig = z.object({
  segmentation: z.object({
    engine: z.enum(['primitive', 'latvian_sentence_tester:local']).default('primitive'),
    engines: z
      .object({
        primitive: z.object({ enabled: z.boolean().default(true) }).optional(),
        'latvian_sentence_tester:local': z
          .object({ enabled: z.boolean().default(false) })
          .optional(),
      })
      .optional(),
  }),
});

export type NlpConfig = z.infer<typeof ZNlpConfig>;
