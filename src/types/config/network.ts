import { z } from 'zod';

export const ZNetworkConfig = z.object({
  apiBaseUrl: z.string().min(1),
  requestTimeoutMs: z.number().int().positive(),
  healthTimeoutMs: z.number().int().positive(),
  llmRouteBase: z.string().min(1).optional(),
});
export type NetworkConfig = z.infer<typeof ZNetworkConfig>;
