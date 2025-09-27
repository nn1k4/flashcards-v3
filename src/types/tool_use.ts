import { z } from 'zod';
import { ZFlashcard } from './dto';

// Zod schema for emit_flashcards.input (JSON-only via tools)
export const ZEmitFlashcardsInput = z.object({
  flashcards: z.array(ZFlashcard).min(1),
});

export type EmitFlashcardsInput = z.infer<typeof ZEmitFlashcardsInput>;

export const EMITTER_TOOL_NAME = 'emit_flashcards' as const;
