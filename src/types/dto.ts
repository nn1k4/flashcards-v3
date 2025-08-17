// src/types/dto.ts
// Версионированные API-DTO результата батча (V1)
import { z } from "zod";

// Флэшкарта
export const ZFlashcard = z.object({
  base_form: z.string(),
  base_translation: z.string().optional(),
  unit: z.enum(["word", "phrase"]).default("word"),
  forms: z
    .array(
      z.object({
        form: z.string(),
        translation: z.string(),
        type: z.string(), // грамматический тип
      })
    )
    .default([]),
  contexts: z
    .array(
      z.object({
        lv: z.string(),
        ru: z.string(),
        sid: z.number().optional(),
        sig: z.string().optional(),
      })
    )
    .default([]),
  visible: z.boolean().default(true),
});

// Элемент результата (V1)
export const ZBatchResultItemV1 = z.object({
  sid: z.number().int().nonnegative(),
  sig: z.string(),
  russian: z.string().optional(),
  cards: z.array(ZFlashcard).optional(),
  warnings: z.array(z.string()).optional(),
  processingTime: z.number().optional(), // ms
});

// Главный результат (V1)
export const ZBatchResultV1 = z.object({
  schemaVersion: z.literal(1),
  batchId: z.string(),
  items: z.array(ZBatchResultItemV1),
  errors: z
    .array(
      z.object({
        sid: z.number().int().nonnegative(),
        error: z.string(),
        errorCode: z.string().optional(),
      })
    )
    .optional(),
  metadata: z
    .object({
      totalProcessingTime: z.number().optional(),
      model: z.string().optional(),
      chunksProcessed: z.number().optional(),
    })
    .optional(),
});

// Типы, выведенные из схем
export type Flashcard = z.infer<typeof ZFlashcard>;
export type BatchResultItemV1 = z.infer<typeof ZBatchResultItemV1>;
export type BatchResultV1 = z.infer<typeof ZBatchResultV1>;
