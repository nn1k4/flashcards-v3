# S3 Flashcards v1 — Design Document

**Date:** 2026-01-01 **Status:** Approved **Session:** S3

---

## Overview

Реализация режима Flashcards — основного способа изучения словарных карточек с front/back
отображением, контекстами и клавиатурной навигацией.

## Decisions

| Решение           | Выбор               | Обоснование                                  |
| ----------------- | ------------------- | -------------------------------------------- |
| Архитектура       | Headless + UI       | Максимальная гибкость, логика отделена от UI |
| State management  | Zustand             | Синхронизация с Edit режимом, devtools       |
| Flip animation    | CSS 3D transforms   | Zero dependencies, performant                |
| Hotkeys           | Custom useHotkeys() | Config-first, переиспользуемо                |
| Context expansion | Кнопка per-card     | Простой UX для MVP                           |
| Form highlighting | Regex + mark        | Достаточно для точных совпадений             |

---

## Architecture

### File Structure

```
src/
├── stores/
│   └── flashcardsStore.ts      # Zustand store
├── hooks/
│   ├── useFlashcards.ts        # headless логика навигации/flip
│   └── useHotkeys.ts           # обработка клавиш из конфига
├── components/
│   └── Flashcards/
│       ├── index.ts            # re-export
│       ├── FlashcardsView.tsx  # контейнер с hotkeys
│       ├── Card.tsx            # карточка с flip
│       ├── CardFace.tsx        # front/back face
│       ├── ContextList.tsx     # список контекстов с expand
│       └── Navigation.tsx      # ←/→ кнопки
├── utils/
│   └── highlightForm.tsx       # regex подсветка
└── types/
    └── config/
        └── flashcards.ts       # Zod schema (update)
```

### Data Flow

```
[Zustand Store] ← cards[], currentIndex, expandedContexts
       ↓
[useFlashcards()] → { current, next, prev, flip, isFlipped, hide }
       ↓
[FlashcardsView] ← useHotkeys() слушает ←/→/Space/h
       ↓
[Card] → CSS 3D flip animation
       ↓
[CardFace] + [ContextList] → highlightForm()
```

---

## Zustand Store

```typescript
interface FlashcardsState {
  // Data
  cards: Flashcard[];

  // Navigation
  currentIndex: number;
  isFlipped: boolean;

  // Per-card expanded contexts: cardIndex → count
  expandedContexts: Map<number, number>;

  // Actions
  setCards: (cards: Flashcard[]) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  flip: () => void;
  hide: (index: number) => void;
  show: (index: number) => void;
  toggleVisible: (index: number) => void;
  expandContexts: (cardIndex: number, count: number) => void;
}
```

### Invariants

1. При навигации (next/prev/goTo): `isFlipped = false` — всегда начинаем с front
2. next/prev пропускают `visible: false` карточки
3. currentIndex: clamp к `[0, visibleCards.length - 1]`
4. expandedContexts default = `config.flashcards.contexts.default`

---

## Hooks

### useFlashcards.ts

```typescript
interface UseFlashcardsReturn {
  currentCard: Flashcard | null;
  currentIndex: number;
  totalVisible: number;
  isFlipped: boolean;

  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  flip: () => void;
  hide: () => void;

  visibleContextsCount: number;
  canExpandContexts: boolean;
  expandContexts: () => void;
}
```

### useHotkeys.ts

```typescript
type HotkeyAction = 'next' | 'prev' | 'flip' | 'hide';

interface HotkeyConfig {
  [key: string]: HotkeyAction;
}

function useHotkeys(
  actions: Record<HotkeyAction, () => void>,
  config: HotkeyConfig,
  enabled?: boolean,
): void;
```

---

## UI Components

### FlashcardsView.tsx

Контейнер, подключает useFlashcards и useHotkeys, рендерит Card + Navigation.

### Card.tsx

3D flip карточка с CSS transform. Click = flip.

### CardFace.tsx

- **Front:** base_form + unit badge
- **Back:** base_translation + ContextList

### ContextList.tsx

Список контекстов с кнопкой "+N ещё" для expand.

### Navigation.tsx

Кнопки ←/→ и индикатор "3 / 15".

---

## CSS Flip Animation

```css
.card-container {
  perspective: 1000px;
}

.card {
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
}

.card.is-flipped {
  transform: rotateY(180deg);
}

.card-face {
  backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
}
```

### Theme Support

CSS variables для light/dark:

- `--card-front-bg`, `--card-back-bg`
- `--highlight-bg` для подсветки форм

---

## Config Updates

### config/flashcards.json

```json
{
  "contexts": { "default": 1, "max": 3 },
  "fontFamily": "Noto Sans Display",
  "visibilityPolicy": "all-visible",
  "hotkeys": {
    "ArrowRight": "next",
    "ArrowLeft": "prev",
    " ": "flip",
    "ArrowUp": "flip",
    "ArrowDown": "flip",
    "h": "hide"
  },
  "animation": {
    "duration": 500,
    "easing": "ease"
  }
}
```

---

## Utility: highlightForm

```typescript
function highlightForm(text: string, forms: Flashcard['forms']): React.ReactNode;
```

Regex по всем `forms[].form`, оборачивает в `<mark>`.

---

## Testing Strategy

| Layer       | What                                      | Tool         |
| ----------- | ----------------------------------------- | ------------ |
| Unit        | highlightForm, store reducers, useHotkeys | Vitest       |
| Integration | useFlashcards + store, navigation         | Vitest + RTL |
| Component   | Card flip, ContextList expand             | RTL          |
| E2E         | Hotkeys, navigation, hide                 | Playwright   |

### Key Test Cases

- highlightForm: single/multiple forms, case-insensitive, regex escape
- useFlashcards: next/prev skips hidden, flip resets on nav, expand contexts
- E2E: ←/→ navigation, Space flip, h hide, click flip

---

## Implementation Order

1. Zustand store
2. useHotkeys hook
3. useFlashcards hook
4. highlightForm utility
5. UI components (Card → CardFace → ContextList → Navigation → FlashcardsView)
6. CSS (flip animation + dark theme)
7. Tests (unit → integration → E2E)

---

## Definition of Done

- [ ] Карточки отображают front/back с flip-анимацией
- [ ] Контексты: default N, expand до max M
- [ ] Хоткеи ←/→/Space/↑/↓/h работают
- [ ] Подсветка форм в контекстах
- [ ] При навигации flip сбрасывается на front
- [ ] `h` скрывает карточку (visible: false)
- [ ] Dark theme поддержка
- [ ] Unit + Integration + E2E тесты

---

## Dependencies

```bash
npm install zustand
```
