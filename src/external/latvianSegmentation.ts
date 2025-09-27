// Sourced from /mnt/d/latvian_sentence_tester/project/client/src/utils/latvianSegmentation.ts
// Local copy for flashcards-v3; keep in sync per docs (doc/configs/nlp.md).
const LATVIAN_MONTHS = [
  'janvāris',
  'janvārī',
  'janvāra',
  'janv.',
  'februāris',
  'februārī',
  'februāra',
  'febr.',
  'marts',
  'martā',
  'marta',
  'mart.',
  'aprīlis',
  'aprīlī',
  'aprīļa',
  'apr.',
  'maijs',
  'maijā',
  'maija',
  'jūnijs',
  'jūnijā',
  'jūnija',
  'jūn.',
  'jūlijs',
  'jūlijā',
  'jūlija',
  'jūl.',
  'augusts',
  'augustā',
  'augusta',
  'aug.',
  'septembris',
  'septembrī',
  'septembra',
  'sept.',
  'oktobris',
  'oktobrī',
  'oktobra',
  'okt.',
  'novembris',
  'novembrī',
  'novembra',
  'nov.',
  'decembris',
  'decembrī',
  'decembra',
  'dec.',
];

const LATVIAN_WEEKDAYS = [
  'pirmdiena',
  'pirmdienā',
  'pirmdienas',
  'pirmd.',
  'otrdiena',
  'otrdienā',
  'otrdienas',
  'otrd.',
  'trešdiena',
  'trešdienā',
  'trešdienas',
  'trešd.',
  'ceturtdiena',
  'ceturtdienā',
  'ceturtdienas',
  'ceturtd.',
  'piektdiena',
  'piektdienā',
  'piektdienas',
  'piektd.',
  'sestdiena',
  'sestdienā',
  'sestdienas',
  'sestd.',
  'svētdiena',
  'svētdienā',
  'svētdienas',
  'svētd.',
];

const LATVIAN_ABBREVIATIONS = [
  'u.c.',
  'utt.',
  'piem.',
  'sk.',
  't.i.',
  'u.tml.',
  'nr.',
  'lpp.',
  'lv.',
  'eur.',
  'g.',
  'gs.',
  'st.',
  'k.',
  'dr.',
  'prof.',
  'mg.',
  'bc.',
  'inž.',
  'uzņ.',
  'sabiedr.',
  'a/s',
  'sia',
];

const GEOGRAPHIC_TERMS = [
  'iela',
  'ielā',
  'ielas',
  'prospekts',
  'prospektā',
  'pr.',
  'bulvāris',
  'bulvārī',
  'bulv.',
  'laukums',
  'laukumā',
  'lauk.',
  'rajons',
  'rajonā',
  'raj.',
  'stāvs',
  'stāvā',
  'st.',
  'māja',
  'mājā',
];

function isDatePattern(text: string, dotIndex: number): boolean {
  const beforeDot = text.substring(0, dotIndex).trim();
  const afterDot = text.substring(dotIndex + 1).trim();
  const numberMatch = beforeDot.match(/\b(\d{1,2})$/);
  if (!numberMatch) return false;
  const wordsAfter = afterDot.split(/\s+/);
  if (wordsAfter.length === 0) return false;
  const firstWordAfter = (wordsAfter[0] ?? '').toLowerCase();
  return LATVIAN_MONTHS.includes(firstWordAfter) || LATVIAN_WEEKDAYS.includes(firstWordAfter);
}

function isYearPattern(text: string, dotIndex: number): boolean {
  const beforeDot = text.substring(0, dotIndex).trim();
  const afterDot = text.substring(dotIndex + 1).trim();
  const numberMatch = beforeDot.match(/\b(1[5-9]\d{2}|20\d{2})$/);
  if (!numberMatch) return false;
  const wordsAfter = afterDot.split(/\s+/);
  if (wordsAfter.length === 0) return false;
  const firstWordAfter = (wordsAfter[0] ?? '').toLowerCase();
  const yearWords = ['gads', 'gadā', 'gada', 'g.'];
  return yearWords.some((word) => firstWordAfter.startsWith(word));
}

function isAbbreviation(text: string, dotIndex: number): boolean {
  const beforeDot = text.substring(0, dotIndex + 1).toLowerCase();
  return LATVIAN_ABBREVIATIONS.some((abbr) => {
    const pattern = abbr.toLowerCase();
    return beforeDot.endsWith(' ' + pattern) || beforeDot.endsWith(pattern);
  });
}

function isAddressPattern(text: string, dotIndex: number): boolean {
  const beforeDot = text.substring(0, dotIndex).trim();
  const afterDot = text.substring(dotIndex + 1).trim();
  const numberMatch = beforeDot.match(/\b(\d{1,3})\s*$/);
  if (!numberMatch) return false;
  const wordsAfter = afterDot.split(/\s+/);
  if (wordsAfter.length === 0) return false;
  const firstWordAfter = (wordsAfter[0] ?? '').toLowerCase();
  return GEOGRAPHIC_TERMS.some(
    (term) => firstWordAfter.startsWith(term) || term.startsWith(firstWordAfter),
  );
}

function isListItem(text: string, dotIndex: number): boolean {
  const beforeDot = text.substring(0, dotIndex).trim();
  const listPattern = /^[\s]*([0-9]+|[a-zā-ž])\s*$/i;
  return listPattern.test(beforeDot);
}

export function isTitle(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const hasNoPunctuation = !/[.!?]$/.test(trimmed);
  const isShort = trimmed.length < 60;
  const startsWithCapital = /^[A-ZĀČĒĢĪĶĻŅŠŪŽ]/.test(trimmed);
  const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 2;
  const hasCapitalWords = (trimmed.match(/[A-ZĀČĒĢĪĶĻŅŠŪŽ]/g) || []).length > 1;
  return isAllCaps || (isShort && hasNoPunctuation && startsWithCapital && hasCapitalWords);
}

function processSentencesInLine(text: string): string[] {
  const sentences: string[] = [];
  let currentSentence = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    currentSentence += char;
    if (char === '.' || char === '!' || char === '?') {
      if (char === '.') {
        const dotIndex = i;
        if (
          isDatePattern(text, dotIndex) ||
          isYearPattern(text, dotIndex) ||
          isAbbreviation(text, dotIndex) ||
          isAddressPattern(text, dotIndex) ||
          isListItem(text, dotIndex)
        ) {
          i++;
          continue;
        }
      }
      const nextIndex = i + 1;
      if (nextIndex < text.length) {
        const restText = text.substring(nextIndex);
        const nextNonSpaceMatch = restText.match(/^\s*(.)/);
        if (nextNonSpaceMatch) {
          const nextChar = nextNonSpaceMatch[1] ?? '';
          if (/[A-ZĀČĒĢĪĶĻŅŠŪŽ]/.test(nextChar)) {
            sentences.push(currentSentence.trim());
            currentSentence = '';
          }
        } else {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      } else {
        sentences.push(currentSentence.trim());
        currentSentence = '';
      }
    }
    i++;
  }
  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim());
  }
  return sentences;
}

export function splitIntoSentencesAdvanced(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split(/\n+/).filter((line) => line.trim().length > 0);
  const allSentences: string[] = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (isTitle(trimmedLine)) {
      allSentences.push(trimmedLine);
    } else {
      const sentencesInLine = processSentencesInLine(trimmedLine);
      allSentences.push(...sentencesInLine);
    }
  }
  return allSentences.filter((s) => s.length > 2);
}
