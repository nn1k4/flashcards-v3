import { z } from 'zod';

export const ZTranslationConfig = z.object({
  stats: z.object({
    words: z.boolean(),
    graphemes: z.boolean(),
    sentences: z.boolean(),
    phrases: z.boolean(),
  }),
});
export type TranslationConfig = z.infer<typeof ZTranslationConfig>;
