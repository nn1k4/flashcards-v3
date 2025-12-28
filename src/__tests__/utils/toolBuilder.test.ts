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
});
