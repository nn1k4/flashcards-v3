import { z } from 'zod';

// === Схемы манифеста (минимально необходимые для валидации входа) ===
export const ZManifestItem = z.object({
  sid: z.number().int().nonnegative(),
  lv: z.string().min(1),
  sig: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
});

export const ZManifest = z.object({
  batchId: z.string().min(1),
  source: z.string().min(1),
  items: z.array(ZManifestItem).min(1),
  createdAt: z.string().min(1),
  version: z.string().min(1)
});
export type Manifest = z.infer<typeof ZManifest>;

// === Схемы ответа (точно как на фронте) ===
export const ZFlashcard = z.object({
  base_form: z.string(),
  base_translation: z.string().optional(),
  unit: z.enum(['word', 'phrase']).default('word'),
  forms: z.array(z.object({
    form: z.string(),
    translation: z.string(),
    type: z.string(),
  })).default([]),
  contexts: z.array(z.object({
    lv: z.string(),
    ru: z.string(),
    sid: z.number().optional(),
    sig: z.string().optional(),
  })).default([]),
  visible: z.boolean().default(true),
});

export const ZBatchResultItemV1 = z.object({
  sid: z.number().int().nonnegative(),
  sig: z.string(),
  russian: z.string().optional(),
  cards: z.array(ZFlashcard).optional(),
  warnings: z.array(z.string()).optional(),
  processingTime: z.number().optional(),
});

export const ZBatchResultV1 = z.object({
  schemaVersion: z.literal(1),
  batchId: z.string(),
  items: z.array(ZBatchResultItemV1),
  errors: z.array(z.object({
    sid: z.number().int().nonnegative(),
    error: z.string(),
    errorCode: z.string().optional(),
  })).optional(),
  metadata: z.object({
    totalProcessingTime: z.number().optional(),
    model: z.string().optional(),
    chunksProcessed: z.number().optional(),
  }).optional(),
});
export type BatchResultV1 = z.infer<typeof ZBatchResultV1>;
