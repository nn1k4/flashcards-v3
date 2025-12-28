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

/**
 * Строит ToolDefinition для emit_flashcards инструмента.
 * Преобразует Zod схему в JSON Schema для Claude API.
 *
 * @returns ToolDefinition с именем, описанием и JSON Schema для input
 */
export function buildEmitFlashcardsTool(): ToolDefinition {
  const schema = ZEmitFlashcardsInput as any;
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  });
  const { _$schema, ...inputSchema } = jsonSchema as any;
  return {
    name: EMITTER_TOOL_NAME,
    description: EMIT_FLASHCARDS_DESCRIPTION,
    input_schema: inputSchema,
  };
}

/**
 * Generic tool builder функция для построения ToolDefinition из Zod схемы.
 * Преобразует Zod схему в JSON Schema для Claude API с кастомными опциями.
 *
 * @param name - Имя tool
 * @param description - Описание tool
 * @param schema - Zod схема для input
 * @param options - Опции для построения JSON Schema
 * @returns ToolDefinition с именем, описанием и JSON Schema для input
 */
export function buildToolFromZodSchema(
  name: string,
  description: string,
  schema: z.ZodType,
  options: ToolBuildOptions = {},
): ToolDefinition {
  const defaultOptions = {
    target: 'jsonSchema7' as const,
    strictNullChecks: true,
    $refStrategy: 'none' as const,
  };
  const mergedOptions = { ...defaultOptions, ...options };
  const jsonSchema = zodToJsonSchema(schema, mergedOptions as any);
  const { _$schema, ...inputSchema } = jsonSchema as any;
  return {
    name,
    description,
    input_schema: inputSchema,
  };
}
