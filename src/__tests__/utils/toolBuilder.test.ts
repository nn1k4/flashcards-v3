import { describe, expect, it } from 'vitest';
import { buildEmitFlashcardsTool } from '../../utils/toolBuilder';

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

  describe('Task 5: JSON Schema structure tests', () => {
    it('input_schema should be an object', () => {
      const tool = buildEmitFlashcardsTool();
      expect(typeof tool.input_schema).toBe('object');
    });

    it('input_schema should be JSON-serializable', () => {
      const tool = buildEmitFlashcardsTool();
      expect(() => {
        JSON.stringify(tool.input_schema);
      }).not.toThrow();
    });

    it('input_schema should have type "object"', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      expect(schema.type).toBe('object');
    });

    it('input_schema should have properties object', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      expect(schema).toHaveProperty('properties');
      expect(typeof schema.properties).toBe('object');
    });

    it('input_schema should have required array with "flashcards"', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      expect(schema).toHaveProperty('required');
      expect(Array.isArray(schema.required)).toBe(true);
      expect(schema.required).toContain('flashcards');
    });

    it('flashcards property should be an array type', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardsSchema = schema.properties.flashcards;
      expect(flashcardsSchema.type).toBe('array');
    });

    it('flashcards array should have minItems constraint', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardsSchema = schema.properties.flashcards;
      expect(flashcardsSchema).toHaveProperty('minItems');
      expect(flashcardsSchema.minItems).toBe(1);
    });

    it('flashcards items should be objects', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardsSchema = schema.properties.flashcards;
      expect(flashcardsSchema.items).toBeDefined();
      expect(flashcardsSchema.items.type).toBe('object');
    });
  });

  describe('Task 6: Nested Flashcard schema tests', () => {
    it('flashcard should have base_form property', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties).toHaveProperty('base_form');
      expect(flashcardSchema.properties.base_form.type).toBe('string');
    });

    it('base_form should be required', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.required).toContain('base_form');
    });

    it('flashcard should have unit property with enum constraints', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties).toHaveProperty('unit');
      expect(flashcardSchema.properties.unit).toHaveProperty('enum');
      expect(flashcardSchema.properties.unit.enum).toEqual(['word', 'phrase']);
    });

    it('unit should have default value "word"', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties.unit).toHaveProperty('default');
      expect(flashcardSchema.properties.unit.default).toBe('word');
    });

    it('flashcard should have visible property with boolean type', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties).toHaveProperty('visible');
      expect(flashcardSchema.properties.visible.type).toBe('boolean');
    });

    it('visible should have default value true', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties.visible).toHaveProperty('default');
      expect(flashcardSchema.properties.visible.default).toBe(true);
    });

    it('flashcard should have contexts array property', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties).toHaveProperty('contexts');
      expect(flashcardSchema.properties.contexts.type).toBe('array');
    });

    it('contexts items should be objects with lv and ru properties', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      const contextsItems = flashcardSchema.properties.contexts.items;
      expect(contextsItems.type).toBe('object');
      expect(contextsItems.properties).toHaveProperty('lv');
      expect(contextsItems.properties).toHaveProperty('ru');
    });

    it('contexts should have default empty array', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties.contexts).toHaveProperty('default');
      expect(flashcardSchema.properties.contexts.default).toEqual([]);
    });

    it('flashcard should have forms array property', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties).toHaveProperty('forms');
      expect(flashcardSchema.properties.forms.type).toBe('array');
    });

    it('forms items should be objects with form, translation, and type properties', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      const formsItems = flashcardSchema.properties.forms.items;
      expect(formsItems.type).toBe('object');
      expect(formsItems.properties).toHaveProperty('form');
      expect(formsItems.properties).toHaveProperty('translation');
      expect(formsItems.properties).toHaveProperty('type');
    });

    it('forms should have default empty array', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      expect(flashcardSchema.properties.forms).toHaveProperty('default');
      expect(flashcardSchema.properties.forms.default).toEqual([]);
    });
  });

  describe('Task 7: Claude API compatibility tests', () => {
    it('input_schema should not contain $ref', () => {
      const tool = buildEmitFlashcardsTool();
      const schemaString = JSON.stringify(tool.input_schema);
      expect(schemaString).not.toContain('$ref');
    });

    it('input_schema should not contain $schema property', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      expect(schema).not.toHaveProperty('$schema');
    });

    it('input_schema should not contain $id property', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      expect(schema).not.toHaveProperty('$id');
    });

    it('input_schema should be JSON-serializable', () => {
      const tool = buildEmitFlashcardsTool();
      expect(() => {
        JSON.stringify(tool.input_schema);
      }).not.toThrow();
    });

    it('entire tool definition should be JSON-serializable', () => {
      const tool = buildEmitFlashcardsTool();
      expect(() => {
        JSON.stringify(tool);
      }).not.toThrow();
    });

    it('input_schema should not contain undefined values', () => {
      const tool = buildEmitFlashcardsTool();
      const schemaString = JSON.stringify(tool.input_schema);
      expect(schemaString).not.toContain('undefined');
    });

    it('input_schema should have additionalProperties as false or not present (Claude safe)', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      // Should either not have additionalProperties or have it set to false
      const hasAdditionalProperties = 'additionalProperties' in schema;
      if (hasAdditionalProperties) {
        expect(schema.additionalProperties).toBe(false);
      }
    });

    it('nested object schemas should not contain $ref', () => {
      const tool = buildEmitFlashcardsTool();
      const schema = tool.input_schema as any;
      const flashcardSchema = schema.properties.flashcards.items;
      const schemaString = JSON.stringify(flashcardSchema);
      expect(schemaString).not.toContain('$ref');
    });
  });

  describe('Task 8: Idempotence test', () => {
    it('repeated calls should return identical schema', () => {
      const tool1 = buildEmitFlashcardsTool();
      const tool2 = buildEmitFlashcardsTool();
      expect(JSON.stringify(tool1)).toBe(JSON.stringify(tool2));
    });

    it('repeated calls should return identical name', () => {
      const tool1 = buildEmitFlashcardsTool();
      const tool2 = buildEmitFlashcardsTool();
      expect(tool1.name).toBe(tool2.name);
    });

    it('repeated calls should return identical description', () => {
      const tool1 = buildEmitFlashcardsTool();
      const tool2 = buildEmitFlashcardsTool();
      expect(tool1.description).toBe(tool2.description);
    });

    it('repeated calls should produce functionally equivalent input_schema', () => {
      const tool1 = buildEmitFlashcardsTool();
      const tool2 = buildEmitFlashcardsTool();
      expect(tool1.input_schema).toEqual(tool2.input_schema);
    });

    it('multiple sequential calls should all return valid schemas', () => {
      const tools = [
        buildEmitFlashcardsTool(),
        buildEmitFlashcardsTool(),
        buildEmitFlashcardsTool(),
      ];
      tools.forEach((tool) => {
        const schema = tool.input_schema as any;
        expect(tool).toHaveProperty('name', 'emit_flashcards');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('input_schema');
        expect(schema.type).toBe('object');
        expect(schema.properties.flashcards.type).toBe('array');
      });
    });

    it('idempotence should hold across multiple property accesses', () => {
      const tool1 = buildEmitFlashcardsTool();
      const schema = tool1.input_schema as any;
      const flashcards1 = schema.properties.flashcards;
      const flashcards1Again = schema.properties.flashcards;
      expect(JSON.stringify(flashcards1)).toBe(JSON.stringify(flashcards1Again));
    });

    it('flashcard schema structure should be idempotent across calls', () => {
      const tool1 = buildEmitFlashcardsTool();
      const tool2 = buildEmitFlashcardsTool();
      const schema1 = tool1.input_schema as any;
      const schema2 = tool2.input_schema as any;
      const flashcardSchema1 = schema1.properties.flashcards.items;
      const flashcardSchema2 = schema2.properties.flashcards.items;
      expect(JSON.stringify(flashcardSchema1)).toBe(JSON.stringify(flashcardSchema2));
    });
  });
});
