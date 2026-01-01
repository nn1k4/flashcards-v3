import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Flashcard } from '../../types/dto';
import { highlightForm } from '../../utils/highlightForm';

describe('highlightForm', () => {
  const createForms = (formStrings: string[]): Flashcard['forms'] =>
    formStrings.map((form) => ({ form, translation: '', type: '' }));

  it('returns text as-is when forms array is empty', () => {
    const result = highlightForm('Hello world', []);
    expect(result).toBe('Hello world');
  });

  it('returns text as-is when forms is undefined-ish', () => {
    const result = highlightForm('Hello world', undefined as any);
    expect(result).toBe('Hello world');
  });

  it('highlights a single form occurrence', () => {
    const forms = createForms(['mācos']);
    const { container } = render(<>{highlightForm('Es mācos latviešu valodu', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('mācos');
  });

  it('highlights multiple occurrences of the same form', () => {
    const forms = createForms(['es']);
    const { container } = render(<>{highlightForm('Es mācos, es studēju', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
  });

  it('highlights multiple different forms', () => {
    const forms = createForms(['mācos', 'mācās']);
    const { container } = render(<>{highlightForm('Es mācos, viņš mācās', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(marks[0]?.textContent).toBe('mācos');
    expect(marks[1]?.textContent).toBe('mācās');
  });

  it('is case-insensitive', () => {
    const forms = createForms(['Mācos']);
    const { container } = render(<>{highlightForm('Es MĀCOS katru dienu', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('MĀCOS');
  });

  it('escapes regex special characters in forms', () => {
    const forms = createForms(['test.*']);
    const { container } = render(<>{highlightForm('This is test.* pattern', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('test.*');
  });

  it('prefers longer forms when they overlap', () => {
    const forms = createForms(['māc', 'mācos']);
    const { container } = render(<>{highlightForm('Es mācos', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    // Should match 'mācos' not just 'māc'
    expect(marks[0]?.textContent).toBe('mācos');
  });

  it('handles empty form strings gracefully', () => {
    const forms = createForms(['', 'mācos', '']);
    const { container } = render(<>{highlightForm('Es mācos', forms)}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('mācos');
  });

  it('returns original text when no forms match', () => {
    const forms = createForms(['xyz']);
    const result = highlightForm('Es mācos latviešu valodu', forms);
    expect(result).toBe('Es mācos latviešu valodu');
  });
});
