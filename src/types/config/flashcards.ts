import { z } from 'zod';

export const ZFlashcardsConfig = z.object({
  contexts: z.object({ default: z.number().int().positive(), max: z.number().int().positive() }),
  fontFamily: z.string().min(1),
  visibilityPolicy: z.enum(['all-visible', 'reveal-on-peek']).default('all-visible'),
});
export type FlashcardsConfig = z.infer<typeof ZFlashcardsConfig>;
