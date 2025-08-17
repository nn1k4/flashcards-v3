// src/utils/splitter.ts
// Детерминированный сплиттер латышских предложений
// Гарантирует, что одинаковый входной текст всегда даёт одинаковый результат

/**
 * Нормализует текст для стабильной обработки:
 * - выравнивает переводы строк
 * - слипает многострочные блоки в один пробел
 * - убирает повторные пробелы
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Windows → \n
    .replace(/\r/g, '\n') // Mac → \n
    .replace(/\s*\n\s*/g, ' ') // переносы строк → пробел
    .replace(/\s+/g, ' ') // множественные пробелы → один
    .trim();
}

/**
 * Детерминированное разбиение на предложения.
 * КРИТИЧЕСКИЙ ИНВАРИАНТ:
 * normalizeText(splitIntoSentencesDeterministic(t).join(' ')) === normalizeText(t)
 */
export function splitIntoSentencesDeterministic(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const sentences: string[] = [];
  let current = '';
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i]!;
    current += ch;

    // Простой, но стабильный критерий конца предложения
    if (/[.!?…]/.test(ch)) {
      const next = normalized[i + 1];
      if (!next || /\s/.test(next)) {
        sentences.push(current.trim());
        current = '';

        // Пропустить хвостовые пробелы
        while (i + 1 < normalized.length && /\s/.test(normalized[i + 1]!)) i++;
      }
    }

    i++;
  }

  if (current.trim()) sentences.push(current.trim());
  return sentences.filter((s) => s.length > 0);
}

/**
 * Валидация инварианта сплиттера:
 * после объединения предложений нормализованный текст равен исходному нормализованному.
 */
export function validateSplitterInvariant(originalText: string, sentences: string[]): void {
  const rejoined = sentences.join(' ');
  const a = normalizeText(originalText);
  const b = normalizeText(rejoined);
  if (a !== b) {
    throw new Error(`Splitter invariant violated:\nOriginal: "${a}"\nRejoined: "${b}"`);
  }
}

/** Универсальный base64 (UTF-8) без прямой зависимости от типов Node. */
function toBase64Utf8(str: string): string {
  const g: any = globalThis as any;

  // Браузерный путь (DOM)
  if (typeof g.btoa === 'function') {
    // Корректная UTF-8 упаковка для btoa

    return g.btoa(unescape(encodeURIComponent(str)));
  }

  // Node-подобный путь (без прямого типа Buffer)
  const B: any = g.Buffer;
  if (B && typeof B.from === 'function') {
    return B.from(str, 'utf8').toString('base64');
  }

  throw new Error('No base64 encoder available');
}

/**
 * Создание стабильной сигнатуры для предложения:
 * base64 от "<normalized>#<sid>" (БЕЗ усечения).
 * Важно: единая точка истины для алгоритма сигнатуры.
 */
export function createSignature(text: string, sid: number): string {
  const normalized = normalizeText(text);
  const content = `${normalized}#${sid}`;
  return toBase64Utf8(content); // полный base64 по плану (без slice)
}

// Экспорт для тестов
export const __testing = { normalizeText, validateSplitterInvariant, createSignature };
