import { z } from 'zod';

export const ZIoConfig = z.object({
  import: z.object({
    allowed: z.array(z.string().min(1)).min(1),
    maxFileSizeMB: z.number().int().positive(),
    defaultMerge: z
      .enum(['replace-all', 'merge-keep-local', 'merge-prefer-imported'])
      .default('merge-prefer-imported'),
  }),
  export: z.object({ formats: z.array(z.string().min(1)).min(1), includeMeta: z.boolean() }),
});
export type IoConfig = z.infer<typeof ZIoConfig>;
