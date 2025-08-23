import { z } from 'zod';

export const ZAppConfig = z.object({
  appName: z.string().min(1),
  version: z.string().min(1),
  defaultLocale: z.string().min(2),
  supportedLocales: z.array(z.string().min(2)).min(1),
});
export type AppConfig = z.infer<typeof ZAppConfig>;
