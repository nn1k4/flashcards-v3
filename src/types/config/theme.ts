import { z } from 'zod';

export const ZThemeConfig = z.object({
  default: z.enum(['light', 'dark', 'system']).default('system'),
  darkClass: z.string().default('dark'),
  tokens: z.record(z.string()).default({}),
});
export type ThemeConfig = z.infer<typeof ZThemeConfig>;
