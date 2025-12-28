import { z } from 'zod';
import type { JsonSchema7Type } from 'zod-to-json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { EMITTER_TOOL_NAME, ZEmitFlashcardsInput } from '../types/tool_use';

// Re-export for use in tool building functions
export { EMITTER_TOOL_NAME, z, ZEmitFlashcardsInput, zodToJsonSchema };
export type { JsonSchema7Type };

/**
 * Tool definition согласно Claude Messages API.
 * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchema7Type;
}

/**
 * Опции для построения tool definition.
 */
export interface ToolBuildOptions {
  /** Целевой формат JSON Schema (по умолчанию 'jsonSchema7') */
  target?: 'openApi3' | 'jsonSchema7' | 'jsonSchema2019-09';

  /** Строгая проверка null (по умолчанию true) */
  strictNullChecks?: boolean;

  /** Запретить дополнительные свойства (по умолчанию false для Claude) */
  additionalProperties?: boolean;
}

/**
 * Описание emit_flashcards tool для Claude.
 * Используется в buildEmitFlashcardsTool().
 */
export const EMIT_FLASHCARDS_DESCRIPTION =
  'Возвращает строго структурированный JSON с набором флэшкарт (словарных карточек) для изучения латышского языка. ' +
  'Каждая карточка содержит базовую форму слова/фразы, переводы, грамматические формы и контексты использования. ' +
  'Все поля должны строго соответствовать схеме. Никакого текста вне определенных полей.';
