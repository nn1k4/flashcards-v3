# Tool Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task.

**Goal:** Create `src/utils/toolBuilder.ts` that generates JSON Schema for `emit_flashcards` tool
definition from Zod schema, enabling full tool-use integration for Claude API.

**Architecture:** Pure utility functions using `zod-to-json-schema` to convert
`ZEmitFlashcardsInput` into Claude-compatible JSON Schema tool definition. TDD approach with
comprehensive unit tests validating schema structure, Claude API compatibility, and idempotence.

**Tech Stack:** TypeScript (strict mode), Zod, zod-to-json-schema, Vitest

---

## Task 1: Install zod-to-json-schema dependency

**Files:**

- Modify: `package.json` (dependencies section)
- Generate: `package-lock.json`

**Step 1: Install the package**

```bash
npm install zod-to-json-schema
```

Expected: Package installed successfully

**Step 2: Verify installation**

```bash
npm list zod-to-json-schema
```

Expected: Shows installed version (e.g., `zod-to-json-schema@3.x.x`)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add zod-to-json-schema for tool definition generation"
```

---

## Task 2: Create types and constants for tool builder

**Files:**

- Create: `src/utils/toolBuilder.ts`

**Step 1: Write basic type definitions and constants**

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { JsonSchema7Type } from 'zod-to-json-schema';
import { ZEmitFlashcardsInput, EMITTER_TOOL_NAME } from '../types/tool_use';

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
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/utils/toolBuilder.ts
git commit -m "feat(toolBuilder): add types and constants"
```

---

## Task 3: Write failing test for buildEmitFlashcardsTool basic structure

**Files:**

- Create: `src/__tests__/utils/toolBuilder.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { buildEmitFlashcardsTool, EMIT_FLASHCARDS_DESCRIPTION } from '../../utils/toolBuilder';

describe('buildEmitFlashcardsTool', () => {
  it('should return object with name, description, input_schema', () => {
    const tool = buildEmitFlashcardsTool();

    expect(tool).toHaveProperty('name');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('input_schema');
  });

  it('name should be "emit_flashcards"', () => {
    const tool = buildEmitFlashcardsTool();
    expect(tool.name).toBe('emit_flashcards');
  });

  it('description should be non-empty Russian string', () => {
    const tool = buildEmitFlashcardsTool();
    expect(tool.description).toBeTruthy();
    expect(tool.description.length).toBeGreaterThan(50);
    expect(tool.description).toMatch(/[а-яА-Я]/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- toolBuilder.test.ts
```

Expected: FAIL - "buildEmitFlashcardsTool is not a function" or similar

**Step 3: Commit**

```bash
git add src/__tests__/utils/toolBuilder.test.ts
git commit -m "test(toolBuilder): add failing tests for basic structure"
```

---

## Task 4: Implement buildEmitFlashcardsTool

**Files:**

- Modify: `src/utils/toolBuilder.ts`

**Step 1: Write minimal implementation**

Add to `src/utils/toolBuilder.ts`:

```typescript
/**
 * Строит tool definition для emit_flashcards.
 * Использует ZEmitFlashcardsInput из src/types/tool_use.ts.
 *
 * @returns Валидный ToolDefinition объект для Claude API
 */
export function buildEmitFlashcardsTool(): ToolDefinition {
  const schema = ZEmitFlashcardsInput;

  const jsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none', // Все определения инлайн
    strictNullChecks: true,
  });

  // Удаляем $schema поле (Claude его не требует)
  const { $schema, ...inputSchema } = jsonSchema as any;

  return {
    name: EMITTER_TOOL_NAME,
    description: EMIT_FLASHCARDS_DESCRIPTION,
    input_schema: inputSchema,
  };
}
```

**Step 2: Run test to verify it passes**

```bash
npm test -- toolBuilder.test.ts
```

Expected: PASS - all 3 tests passing

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/utils/toolBuilder.ts
git commit -m "feat(toolBuilder): implement buildEmitFlashcardsTool"
```

---

## Task 5: Write tests for JSON Schema structure

**Files:**

- Modify: `src/__tests__/utils/toolBuilder.test.ts`

**Step 1: Add schema structure tests**

Add to `src/__tests__/utils/toolBuilder.test.ts`:

```typescript
describe('input_schema structure', () => {
  let schema: any;

  beforeEach(() => {
    const tool = buildEmitFlashcardsTool();
    schema = tool.input_schema;
  });

  it('should have type: object', () => {
    expect(schema.type).toBe('object');
  });

  it('should contain properties.flashcards', () => {
    expect(schema.properties).toHaveProperty('flashcards');
  });

  it('flashcards should be array', () => {
    expect(schema.properties.flashcards.type).toBe('array');
  });

  it('flashcards should have minItems: 1', () => {
    expect(schema.properties.flashcards.minItems).toBe(1);
  });

  it('required should contain ["flashcards"]', () => {
    expect(schema.required).toEqual(['flashcards']);
  });

  it('should NOT contain $schema field', () => {
    expect(schema).not.toHaveProperty('$schema');
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- toolBuilder.test.ts
```

Expected: PASS - all tests passing (including new structure tests)

**Step 3: Commit**

```bash
git add src/__tests__/utils/toolBuilder.test.ts
git commit -m "test(toolBuilder): add JSON Schema structure validation tests"
```

---

## Task 6: Write tests for nested Flashcard schema

**Files:**

- Modify: `src/__tests__/utils/toolBuilder.test.ts`

**Step 1: Add flashcard item schema tests**

Add to `src/__tests__/utils/toolBuilder.test.ts`:

```typescript
describe('flashcard item schema', () => {
  let itemSchema: any;

  beforeEach(() => {
    const tool = buildEmitFlashcardsTool();
    itemSchema = tool.input_schema.properties.flashcards.items;
  });

  it('should be object type', () => {
    expect(itemSchema.type).toBe('object');
  });

  it('should contain base_form', () => {
    expect(itemSchema.properties).toHaveProperty('base_form');
    expect(itemSchema.properties.base_form.type).toBe('string');
  });

  it('unit should have enum ["word", "phrase"]', () => {
    expect(itemSchema.properties.unit.enum).toEqual(['word', 'phrase']);
  });

  it('base_translation should be optional', () => {
    expect(itemSchema.required).not.toContain('base_translation');
  });

  it('contexts should be required array', () => {
    expect(itemSchema.required).toContain('contexts');
    expect(itemSchema.properties.contexts.type).toBe('array');
  });

  it('visible should have default: true', () => {
    expect(itemSchema.properties.visible.default).toBe(true);
  });

  it('forms should be array with items', () => {
    expect(itemSchema.properties.forms.type).toBe('array');
    expect(itemSchema.properties.forms.items).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- toolBuilder.test.ts
```

Expected: PASS - all tests passing

**Step 3: Commit**

```bash
git add src/__tests__/utils/toolBuilder.test.ts
git commit -m "test(toolBuilder): add flashcard item schema validation tests"
```

---

## Task 7: Write tests for Claude API compatibility

**Files:**

- Modify: `src/__tests__/utils/toolBuilder.test.ts`

**Step 1: Add compatibility tests**

Add to `src/__tests__/utils/toolBuilder.test.ts`:

```typescript
describe('Claude API compatibility', () => {
  let schema: any;

  beforeEach(() => {
    const tool = buildEmitFlashcardsTool();
    schema = tool.input_schema;
  });

  it('should NOT contain $ref', () => {
    const jsonStr = JSON.stringify(schema);
    expect(jsonStr).not.toContain('$ref');
  });

  it('should be JSON-serializable', () => {
    expect(() => JSON.stringify(schema)).not.toThrow();
  });

  it('should be valid JSON Schema v7', () => {
    expect(schema.type).toBeDefined();
    expect(schema.properties).toBeDefined();
  });

  it('should have all definitions inlined', () => {
    const jsonStr = JSON.stringify(schema);
    expect(jsonStr).not.toContain('definitions');
    expect(jsonStr).not.toContain('$defs');
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- toolBuilder.test.ts
```

Expected: PASS - all tests passing

**Step 3: Commit**

```bash
git add src/__tests__/utils/toolBuilder.test.ts
git commit -m "test(toolBuilder): add Claude API compatibility tests"
```

---

## Task 8: Write test for idempotence

**Files:**

- Modify: `src/__tests__/utils/toolBuilder.test.ts`

**Step 1: Add idempotence test**

Add to `src/__tests__/utils/toolBuilder.test.ts`:

```typescript
describe('idempotence', () => {
  it('repeated calls should return equivalent objects', () => {
    const tool1 = buildEmitFlashcardsTool();
    const tool2 = buildEmitFlashcardsTool();

    expect(tool1).toEqual(tool2);
    expect(JSON.stringify(tool1)).toBe(JSON.stringify(tool2));
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- toolBuilder.test.ts
```

Expected: PASS - all tests passing

**Step 3: Commit**

```bash
git add src/__tests__/utils/toolBuilder.test.ts
git commit -m "test(toolBuilder): add idempotence test"
```

---

## Task 9: Implement buildToolFromZodSchema (generic function)

**Files:**

- Modify: `src/utils/toolBuilder.ts`

**Step 1: Write the implementation**

Add to `src/utils/toolBuilder.ts`:

```typescript
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
  options: ToolBuildOptions = {},
): ToolDefinition {
  // Дефолтные опции для Claude API
  const defaultOptions = {
    target: 'jsonSchema7' as const,
    strictNullChecks: true,
    $refStrategy: 'none' as const,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Генерация JSON Schema
  const jsonSchema = zodToJsonSchema(schema, mergedOptions);

  // Удаление $schema
  const { $schema, ...inputSchema } = jsonSchema as any;

  return {
    name,
    description,
    input_schema: inputSchema,
  };
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/utils/toolBuilder.ts
git commit -m "feat(toolBuilder): add buildToolFromZodSchema generic function"
```

---

## Task 10: Write tests for buildToolFromZodSchema

**Files:**

- Modify: `src/__tests__/utils/toolBuilder.test.ts`

**Step 1: Add generic function tests**

Add to `src/__tests__/utils/toolBuilder.test.ts`:

```typescript
import { buildToolFromZodSchema } from '../../utils/toolBuilder';
import { z } from 'zod';

describe('buildToolFromZodSchema', () => {
  it('should build tool from custom schema', () => {
    const testSchema = z.object({
      query: z.string(),
      limit: z.number().optional(),
    });

    const tool = buildToolFromZodSchema('test_tool', 'Test tool description', testSchema);

    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('Test tool description');
    expect(tool.input_schema.type).toBe('object');
    expect(tool.input_schema.properties).toHaveProperty('query');
    expect(tool.input_schema.properties).toHaveProperty('limit');
  });

  it('should apply custom options', () => {
    const testSchema = z.object({
      data: z.string(),
    });

    const tool = buildToolFromZodSchema('custom_tool', 'Custom description', testSchema, {
      strictNullChecks: false,
    });

    expect(tool.input_schema).toBeDefined();
    expect(tool.input_schema).not.toHaveProperty('$schema');
  });

  it('should not contain $ref in output', () => {
    const nestedSchema = z.object({
      items: z.array(z.object({ id: z.string(), name: z.string() })),
    });

    const tool = buildToolFromZodSchema('nested', 'Nested test', nestedSchema);

    const jsonStr = JSON.stringify(tool.input_schema);
    expect(jsonStr).not.toContain('$ref');
  });
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- toolBuilder.test.ts
```

Expected: PASS - all tests passing

**Step 3: Commit**

```bash
git add src/__tests__/utils/toolBuilder.test.ts
git commit -m "test(toolBuilder): add tests for buildToolFromZodSchema"
```

---

## Task 11: Run full test suite and check coverage

**Files:**

- None (verification step)

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (39+ tests including new toolBuilder tests)

**Step 2: Check test coverage for toolBuilder**

```bash
npm test -- --coverage toolBuilder
```

Expected: Coverage ≥ 95% for toolBuilder.ts

**Step 3: Run linter**

```bash
npm run lint
```

Expected: No errors

**Step 4: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

Expected: No errors

---

## Task 12: Update tool-use.md documentation

**Files:**

- Modify: `doc/best_practices/tool-use.md`

**Step 1: Add example usage section**

Add to end of `doc/best_practices/tool-use.md` (before final `---`):

````markdown
## 14) Пример использования buildEmitFlashcardsTool()

После реализации в §S2 можно строить tool definition так:

```typescript
import { buildEmitFlashcardsTool } from '@/utils/toolBuilder';

// Получить tool definition
const emitTool = buildEmitFlashcardsTool();

// Использовать в запросе к Claude
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  tools: [emitTool],
  tool_choice: { type: 'tool', name: 'emit_flashcards' },
  disable_parallel_tool_use: true,
  messages: [{ role: 'user', content: 'Проанализируй текст...' }],
});
```
````

Детали реализации: `src/utils/toolBuilder.ts` (построение JSON Schema из Zod).

````

**Step 2: Verify documentation looks correct**

```bash
cat doc/best_practices/tool-use.md | tail -30
````

Expected: New section visible at end

**Step 3: Commit**

```bash
git add doc/best_practices/tool-use.md
git commit -m "docs(tool-use): add buildEmitFlashcardsTool usage example"
```

---

## Task 13: Final verification and summary commit

**Files:**

- None (final checks)

**Step 1: Run complete test suite**

```bash
npm run validate
```

Expected: All tests pass, linter passes

**Step 2: Verify exports are correct**

Create temporary test file:

```bash
cat > /tmp/test-import.ts << 'EOF'
import { buildEmitFlashcardsTool, buildToolFromZodSchema, EMIT_FLASHCARDS_DESCRIPTION, type ToolDefinition } from './src/utils/toolBuilder';
const tool = buildEmitFlashcardsTool();
console.log(tool.name);
EOF

npx tsx /tmp/test-import.ts
rm /tmp/test-import.ts
```

Expected: Prints "emit_flashcards"

**Step 3: Check git status**

```bash
git status
```

Expected: Working tree clean

**Step 4: Review commit history**

```bash
git log --oneline -15
```

Expected: All commits present with clear messages

---

## Acceptance Criteria Checklist

- [ ] `zod-to-json-schema` installed and in package.json
- [ ] `src/utils/toolBuilder.ts` created with all exports
- [ ] `buildEmitFlashcardsTool()` function implemented
- [ ] `buildToolFromZodSchema()` generic function implemented
- [ ] `EMIT_FLASHCARDS_DESCRIPTION` constant defined
- [ ] All unit tests passing (coverage ≥ 95%)
- [ ] TypeScript compiles without errors
- [ ] Linter passes without errors
- [ ] JSON Schema validates:
  - [ ] No $schema field
  - [ ] No $ref references (all inlined)
  - [ ] type: object with properties.flashcards
  - [ ] flashcards has minItems: 1
  - [ ] required: ["flashcards"]
  - [ ] Nested flashcard structure correct
  - [ ] unit enum: ["word", "phrase"]
  - [ ] visible default: true
- [ ] Documentation updated in tool-use.md
- [ ] All commits have clear messages
- [ ] Working tree clean

---

## Next Steps After Completion

After this plan completes successfully:

1. **Integration with LLMAdapter** (future task)
   - Modify `LLMAdapter.ts` to use `buildEmitFlashcardsTool()`
   - Update request building to include tool definition

2. **Integration with BatchAdapter** (future task)
   - Modify `BatchAdapter.ts` to use tool definition
   - Ensure batch requests include tools

3. **E2E testing** (future task)
   - Test actual Claude API calls with generated tool definition
   - Verify tool_use responses parse correctly

4. **Update AGENT.md status** (immediate)
   - Change "tool-use отсутствует" to "tool-use реализовано"
   - Update S2 status to 100%
