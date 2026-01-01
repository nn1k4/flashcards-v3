import type { ReactNode } from 'react';
import type { Flashcard } from '../types/dto';

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights all occurrences of word forms in a text.
 * Wraps matching forms in <mark> elements.
 *
 * @param text - The LV text to highlight forms in
 * @param forms - Array of forms from the flashcard
 * @returns React nodes with highlighted forms
 */
export function highlightForm(text: string, forms: Flashcard['forms']): ReactNode {
  if (!forms || forms.length === 0) return text;

  // Build regex pattern from all forms
  const formStrings = forms.map((f) => f.form).filter((f) => f.length > 0);
  if (formStrings.length === 0) return text;

  // Sort by length descending to match longer forms first
  const sortedForms = [...formStrings].sort((a, b) => b.length - a.length);

  const pattern = sortedForms.map(escapeRegex).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  const parts = text.split(regex);

  // If no splits occurred, return original text
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    // Check if this part matches any form (case-insensitive)
    const isMatch = formStrings.some((form) => form.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return <mark key={index}>{part}</mark>;
    }
    return part;
  });
}
