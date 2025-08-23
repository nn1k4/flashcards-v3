import { z } from 'zod';

export const ZReadingConfig = z.object({
  tooltip: z.object({
    showDelayMs: z.number().int().nonnegative(),
    debounceMs: z.number().int().nonnegative(),
    cancelOnLeave: z.boolean(),
    singleFlight: z.boolean(),
  }),
});
export type ReadingConfig = z.infer<typeof ZReadingConfig>;
