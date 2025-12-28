# Tool Builder Design — JSON Schema генерация для emit_flashcards

**Дата:** 2025-12-29 **Статус:** Утвержден **Связь с TRS:** §3 (Config-first), §4.3 (Tool-use
JSON-only) **Связь с планами:** plan_1.md §1.3 (Pipeline и Tool-use)

---

## 1. Обзор и цели

### 1.1 Проблема

Для достижения S2 100% необходимо полностью реализовать tool-use механизм для Claude API. Текущее
состояние:

- ✅ Zod-схема `ZEmitFlashcardsInput` существует в `src/types/tool_use.ts`
- ✅ `LLMAdapter` умеет парсить `tool_use.input` из ответов
- ❌ Отсутствует генерация JSON Schema для tool definition
- ❌ Нет функции, которая создает корректный tool definition объект для отправки в Claude API

### 1.2 Решение

Создать утилиту `src/utils/toolBuilder.ts`, которая:

1. Преобразует Zod-схему в JSON Schema формат Claude API
2. Строит корректный tool definition объект
3. Обеспечивает типобезопасность и тестируемость
4. Позволяет легко расширять на другие tools в будущем

### 1.3 Требования

**Функциональные:**

- Генерировать JSON Schema из `ZEmitFlashcardsInput`
- Возвращать валидный `ToolDefinition` объект
- Соответствовать формату Claude Messages API
- Поддерживать все Zod-типы, используемые в схеме

**Нефункциональные:**

- TypeScript strict mode совместимость
- 100% покрытие unit-тестами
- Pure функции (без side effects)
- Документация на русском языке

---

## 2. Архитектура

### 2.1 Модульная структура

```
src/utils/toolBuilder.ts                  # Основная реализация
src/__tests__/utils/toolBuilder.test.ts   # Unit-тесты
```

### 2.2 Зависимости

**NPM пакеты:**

- `zod-to-json-schema` — конвертация Zod → JSON Schema
- `zod` — уже используется в проекте

**Внутренние модули:**

- `src/types/tool_use.ts` — источник `ZEmitFlashcardsInput` и `EMITTER_TOOL_NAME`

### 2.3 Политика из tool-use.md

- Единственный tool `emit_flashcards` с фиксированным `tool_choice`
- `disable_parallel_tool_use: true`
- Описание на русском языке (для контекста модели)
- JSON-only режим — никаких текстовых ответов вне tool_use.input

---

## 3. API и интерфейсы

### 3.1 Экспортируемые функции

```typescript
/**
 * Строит tool definition для emit_flashcards.
 * Использует ZEmitFlashcardsInput из src/types/tool_use.ts.
 *
 * @returns Валидный ToolDefinition объект для Claude API
 */
export function buildEmitFlashcardsTool(): ToolDefinition;

/**
 * Универсальная функция для построения tool definition из Zod схемы.
 * Используется для расширения на другие tools в будущем.
 *
 * @param name - Имя tool (например, "emit_flashcards")
 * @param description - Описание tool для модели
 * @param schema - Zod схема для input
 * @param options - Опции генерации JSON Schema
 * @returns Валидный ToolDefinition объект
 */
export function buildToolFromZodSchema(
  name: string,
  description: string,
  schema: z.ZodType,
  options?: ToolBuildOptions,
): ToolDefinition;
```

### 3.2 Типы

```typescript
/**
 * Tool definition согласно Claude Messages API.
 * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema;
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

  /** Стратегия обработки $ref (по умолчанию 'none' — все инлайн) */
  $refStrategy?: 'root' | 'relative' | 'none';
}

/**
 * JSON Schema тип из zod-to-json-schema.
 */
type JSONSchema = ReturnType<typeof zodToJsonSchema>;
```

### 3.3 Константы

```typescript
/**
 * Описание emit_flashcards tool для Claude.
 * Используется в buildEmitFlashcardsTool().
 */
export const EMIT_FLASHCARDS_DESCRIPTION =
  'Возвращает строго структурированный JSON с набором флэшкарт (словарных карточек) для изучения латышского языка. ' +
  'Каждая карточка содержит базовую форму слова/фразы, переводы, грамматические формы и контексты использования. ' +
  'Все поля должны строго соответствовать схеме. Никакого текста вне определенных полей.';
```

---

## 4. Детали реализации

### 4.1 buildEmitFlashcardsTool()

**Псевдокод:**

```typescript
export function buildEmitFlashcardsTool(): ToolDefinition {
  // 1. Импортируем схему
  const schema = ZEmitFlashcardsInput;

  // 2. Генерируем JSON Schema с опциями для Claude
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none', // Все определения инлайн
    strictNullChecks: true,
  });

  // 3. Убираем $schema поле (Claude его не требует)
  const { $schema, ...inputSchema } = jsonSchema;

  // 4. Возвращаем tool definition
  return {
    name: EMITTER_TOOL_NAME,
    description: EMIT_FLASHCARDS_DESCRIPTION,
    input_schema: inputSchema,
  };
}
```

### 4.2 buildToolFromZodSchema()

**Псевдокод:**

```typescript
export function buildToolFromZodSchema(
  name: string,
  description: string,
  schema: z.ZodType,
  options: ToolBuildOptions = {},
): ToolDefinition {
  // Дефолтные опции для Claude API
  const defaultOptions: Required<ToolBuildOptions> = {
    target: 'jsonSchema7',
    strictNullChecks: true,
    additionalProperties: false,
    $refStrategy: 'none',
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Генерация JSON Schema
  const jsonSchema = zodToJsonSchema(schema, mergedOptions);

  // Удаление $schema
  const { $schema, ...inputSchema } = jsonSchema;

  return {
    name,
    description,
    input_schema: inputSchema,
  };
}
```

### 4.3 Обработка Zod-типов

**Маппинг Zod → JSON Schema:**

| Zod тип            | JSON Schema                                 |
| ------------------ | ------------------------------------------- |
| `z.string()`       | `{ "type": "string" }`                      |
| `z.number()`       | `{ "type": "number" }`                      |
| `z.boolean()`      | `{ "type": "boolean" }`                     |
| `z.array(T)`       | `{ "type": "array", "items": {...} }`       |
| `z.object({...})`  | `{ "type": "object", "properties": {...} }` |
| `z.enum([...])`    | `{ "type": "string", "enum": [...] }`       |
| `z.optional()`     | Не включается в `required`                  |
| `z.default(v)`     | Добавляется `"default": v`                  |
| `z.array().min(n)` | Добавляется `"minItems": n`                 |

**Особенности:**

- `ZEmitFlashcardsInput` содержит `flashcards: z.array(...).min(1)` → JSON Schema будет иметь
  `"minItems": 1`

- Вложенные объекты (Flashcard, Context) инлайнятся полностью

- `z.enum(['word', 'phrase'])` → `"enum": ["word", "phrase"]`

### 4.4 Совместимость с Claude API

**Требования Claude:**

1. ✅ JSON Schema v7 формат
2. ✅ Все `$ref` инлайн (нет внешних референсов)
3. ✅ Поле `$schema` опционально (удаляем для чистоты)
4. ✅ `type` обязателен на верхнем уровне
5. ✅ `required` массив явно указан

**Проверка:**

- Сгенерированный schema должен быть валиден по JSON Schema v7
- Должен успешно парситься Claude API (проверяется в интеграционных тестах позже)

---

## 5. Тестирование

### 5.1 Unit-тесты

**Файл:** `src/__tests__/utils/toolBuilder.test.ts`

**Тестовые сценарии:**

#### 5.1.1 Базовая генерация

```typescript
describe('buildEmitFlashcardsTool', () => {
  it('должна возвращать объект с name, description, input_schema', () => {
    const tool = buildEmitFlashcardsTool();

    expect(tool).toHaveProperty('name');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('input_schema');
  });

  it('name должен быть "emit_flashcards"', () => {
    const tool = buildEmitFlashcardsTool();
    expect(tool.name).toBe('emit_flashcards');
  });

  it('description должна быть непустой строкой на русском', () => {
    const tool = buildEmitFlashcardsTool();
    expect(tool.description).toBeTruthy();
    expect(tool.description.length).toBeGreaterThan(50);
    // Проверка на кириллицу
    expect(tool.description).toMatch(/[а-яА-Я]/);
  });
});
```

#### 5.1.2 Структура JSON Schema

```typescript
describe('input_schema структура', () => {
  let schema: any;

  beforeEach(() => {
    const tool = buildEmitFlashcardsTool();
    schema = tool.input_schema;
  });

  it('должна иметь type: object', () => {
    expect(schema.type).toBe('object');
  });

  it('должна содержать properties.flashcards', () => {
    expect(schema.properties).toHaveProperty('flashcards');
  });

  it('flashcards должен быть массивом', () => {
    expect(schema.properties.flashcards.type).toBe('array');
  });

  it('flashcards должен иметь minItems: 1', () => {
    expect(schema.properties.flashcards.minItems).toBe(1);
  });

  it('required должен содержать ["flashcards"]', () => {
    expect(schema.required).toEqual(['flashcards']);
  });

  it('НЕ должна содержать $schema поле', () => {
    expect(schema).not.toHaveProperty('$schema');
  });
});
```

#### 5.1.3 Вложенная структура Flashcard

```typescript
describe('flashcard item schema', () => {
  let itemSchema: any;

  beforeEach(() => {
    const tool = buildEmitFlashcardsTool();
    itemSchema = tool.input_schema.properties.flashcards.items;
  });

  it('должна быть объектом', () => {
    expect(itemSchema.type).toBe('object');
  });

  it('должна содержать base_form', () => {
    expect(itemSchema.properties).toHaveProperty('base_form');
    expect(itemSchema.properties.base_form.type).toBe('string');
  });

  it('unit должен иметь enum ["word", "phrase"]', () => {
    expect(itemSchema.properties.unit.enum).toEqual(['word', 'phrase']);
  });

  it('base_translation должна быть опциональной', () => {
    expect(itemSchema.required).not.toContain('base_translation');
  });

  it('contexts должен быть обязательным массивом', () => {
    expect(itemSchema.required).toContain('contexts');
    expect(itemSchema.properties.contexts.type).toBe('array');
  });

  it('visible должен иметь default: true', () => {
    expect(itemSchema.properties.visible.default).toBe(true);
  });
});
```

#### 5.1.4 Совместимость с Claude API

```typescript
describe('совместимость с Claude API', () => {
  let schema: any;

  beforeEach(() => {
    const tool = buildEmitFlashcardsTool();
    schema = tool.input_schema;
  });

  it('НЕ должна содержать $ref', () => {
    const jsonStr = JSON.stringify(schema);
    expect(jsonStr).not.toContain('$ref');
  });

  it('должна быть JSON-сериализуемой', () => {
    expect(() => JSON.stringify(schema)).not.toThrow();
  });

  it('должна быть валидной JSON Schema v7', () => {
    // Можно использовать ajv для валидации
    // Здесь упрощенная проверка
    expect(schema.type).toBeDefined();
    expect(schema.properties).toBeDefined();
  });
});
```

#### 5.1.5 Идемпотентность

```typescript
describe('идемпотентность', () => {
  it('повторные вызовы должны возвращать эквивалентные объекты', () => {
    const tool1 = buildEmitFlashcardsTool();
    const tool2 = buildEmitFlashcardsTool();

    expect(tool1).toEqual(tool2);
  });
});
```

### 5.2 Критерии приемки

- ✅ Все unit-тесты проходят (`npm run test`)
- ✅ Линтер не выдает ошибок (`npm run lint`)
- ✅ TypeScript компилируется без ошибок
- ✅ Покрытие кода ≥ 95%
- ✅ Документация JSDoc для всех экспортируемых функций

---

## 6. Пример использования

### 6.1 В коде

```typescript
import { buildEmitFlashcardsTool } from '@/utils/toolBuilder';

// Получить tool definition
const emitTool = buildEmitFlashcardsTool();

// Использовать в запросе к Claude
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  tools: [emitTool], // <-- используем сгенерированный tool
  tool_choice: { type: 'tool', name: 'emit_flashcards' },
  disable_parallel_tool_use: true,
  messages: [{ role: 'user', content: 'Проанализируй текст и создай карточки...' }],
});
```

### 6.2 Выходной JSON Schema (пример)

```json
{
  "name": "emit_flashcards",
  "description": "Возвращает строго структурированный JSON с набором флэшкарт...",
  "input_schema": {
    "type": "object",
    "properties": {
      "flashcards": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "properties": {
            "base_form": { "type": "string" },
            "base_translation": { "type": "string" },
            "unit": {
              "type": "string",
              "enum": ["word", "phrase"],
              "default": "word"
            },
            "forms": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "form": { "type": "string" },
                  "translation": { "type": "string" },
                  "type": { "type": "string" }
                },
                "required": ["form", "translation", "type"]
              },
              "default": []
            },
            "contexts": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "lv": { "type": "string" },
                  "ru": { "type": "string" },
                  "sid": { "type": "number" },
                  "sig": { "type": "string" }
                },
                "required": ["lv", "ru"]
              },
              "default": []
            },
            "visible": {
              "type": "boolean",
              "default": true
            }
          },
          "required": ["base_form", "unit", "contexts", "visible"]
        }
      }
    },
    "required": ["flashcards"]
  }
}
```

---

## 7. Риски и ограничения

### 7.1 Риски

| Риск                                                    | Вероятность | Влияние | Митигация                                                |
| ------------------------------------------------------- | ----------- | ------- | -------------------------------------------------------- |
| `zod-to-json-schema` генерирует несовместимый формат    | Низкая      | Высокое | Покрыть тестами, проверить на совместимость с Claude API |
| Обновление Zod схемы не синхронизируется с tool builder | Средняя     | Среднее | Автоматические тесты при изменении схемы                 |
| Описание tool недостаточно детально для модели          | Низкая      | Среднее | Следовать best practices из tool-use.md                  |

### 7.2 Ограничения

- Поддерживается только `emit_flashcards` tool (расширение на другие tools — в будущем)
- JSON Schema генерируется только в формате v7
- Нет поддержки custom JSON Schema аннотаций из Zod (например, `.describe()` не мапится
  автоматически)

### 7.3 Будущие улучшения

- Добавить кеширование результата `buildEmitFlashcardsTool()` (pure функция)
- Поддержка `.describe()` из Zod → `description` в JSON Schema
- Валидатор JSON Schema на соответствие Claude API требованиям
- CLI команда для генерации tool definition в файл

---

## 8. Связь с другими компонентами

### 8.1 Зависимости

- `src/types/tool_use.ts` — источник `ZEmitFlashcardsInput`
- `zod` — базовая библиотека схем
- `zod-to-json-schema` — NPM пакет (нужно установить)

### 8.2 Потребители (будущие)

- `src/adapters/LLMAdapter.ts` — будет использовать в запросах
- `src/adapters/BatchAdapter.ts` — будет использовать в batch запросах
- `src/hooks/useLLM.ts` — может использовать для построения запросов

### 8.3 Документация

- `doc/best_practices/tool-use.md` — политика и требования
- `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` — примеры из API

---

## 9. Чеклист реализации

- [ ] Установить `zod-to-json-schema`: `npm install zod-to-json-schema`
- [ ] Создать `src/utils/toolBuilder.ts`
- [ ] Реализовать `buildEmitFlashcardsTool()`
- [ ] Реализовать `buildToolFromZodSchema()`
- [ ] Добавить константу `EMIT_FLASHCARDS_DESCRIPTION`
- [ ] Создать `src/__tests__/utils/toolBuilder.test.ts`
- [ ] Написать все тестовые сценарии из §5.1
- [ ] Проверить покрытие кода ≥ 95%
- [ ] Добавить JSDoc комментарии
- [ ] Запустить линтер и исправить ошибки
- [ ] Запустить TypeScript компилятор
- [ ] Вручную проверить сгенерированный JSON Schema
- [ ] Обновить `doc/best_practices/tool-use.md` с примером использования

---

## 10. Заключение

Дизайн обеспечивает:

- ✅ **Типобезопасность** — TypeScript strict mode
- ✅ **Тестируемость** — полное покрытие unit-тестами
- ✅ **Расширяемость** — универсальная функция для других tools
- ✅ **Соответствие политике** — следует doc/best_practices/tool-use.md
- ✅ **Совместимость с API** — корректный формат для Claude Messages API

После реализации и прохождения тестов, модуль готов к интеграции с `LLMAdapter` и `BatchAdapter`.
