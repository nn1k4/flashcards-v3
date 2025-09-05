import { z } from 'zod';

export const ZThemeConfig = z.object({
  default: z.enum(['light', 'dark', 'system']).default('system'),
  darkClass: z.string().default('dark'),
  // Explicit key and value schemas to satisfy Zod v4 signature
  tokens: z.record(z.string(), z.unknown()).default({}),
});
export type ThemeConfig = z.infer<typeof ZThemeConfig>;
