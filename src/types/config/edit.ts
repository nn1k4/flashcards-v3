import { z } from 'zod';

export const ZEditConfig = z.object({
  pageSize: z.number().int().positive(),
});
export type EditConfig = z.infer<typeof ZEditConfig>;
