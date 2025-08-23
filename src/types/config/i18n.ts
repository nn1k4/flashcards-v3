import { z } from 'zod';

export const ZI18nConfig = z.object({
  defaultLocale: z.string().min(2),
  locales: z.array(z.string().min(2)).min(1),
});
export type I18nConfig = z.infer<typeof ZI18nConfig>;
