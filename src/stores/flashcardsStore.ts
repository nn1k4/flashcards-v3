import { create } from 'zustand';
import type { Flashcard } from '../types/dto';

export interface FlashcardsState {
  // Data
  cards: Flashcard[];

  // Navigation
  currentIndex: number;
  isFlipped: boolean;

  // Per-card expanded contexts: cardIndex → count
  expandedContexts: Record<number, number>;

  // Actions
  setCards: (cards: Flashcard[]) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  flip: () => void;
  resetFlip: () => void;
  hide: (index: number) => void;
  show: (index: number) => void;
  toggleVisible: (index: number) => void;
  setExpandedContexts: (cardIndex: number, count: number) => void;
}

// Helper: get visible cards
const getVisibleCards = (cards: Flashcard[]) => cards.filter((c) => c.visible);

// Helper: find next visible index
const findNextVisibleIndex = (
  cards: Flashcard[],
  currentIndex: number,
  direction: 1 | -1,
): number => {
  const visibleCards = getVisibleCards(cards);
  if (visibleCards.length === 0) return 0;

  // Map current index to visible index
  const currentCard = visibleCards[currentIndex];
  if (!currentCard) return 0;

  const newVisibleIndex = currentIndex + direction;
  if (newVisibleIndex < 0) return 0;
  if (newVisibleIndex >= visibleCards.length) return visibleCards.length - 1;
  return newVisibleIndex;
};

export const useFlashcardsStore = create<FlashcardsState>((set, get) => ({
  // Initial state
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  expandedContexts: {},

  // Actions
  setCards: (cards) =>
    set({
      cards,
      currentIndex: 0,
      isFlipped: false,
      expandedContexts: {},
    }),

  next: () => {
    const { cards, currentIndex } = get();
    const visibleCards = getVisibleCards(cards);
    if (visibleCards.length === 0) return;

    const newIndex = findNextVisibleIndex(cards, currentIndex, 1);
    if (newIndex !== currentIndex) {
      set({ currentIndex: newIndex, isFlipped: false });
    }
  },

  prev: () => {
    const { cards, currentIndex } = get();
    const visibleCards = getVisibleCards(cards);
    if (visibleCards.length === 0) return;

    const newIndex = findNextVisibleIndex(cards, currentIndex, -1);
    if (newIndex !== currentIndex) {
      set({ currentIndex: newIndex, isFlipped: false });
    }
  },

  goTo: (index) => {
    const { cards } = get();
    const visibleCards = getVisibleCards(cards);
    if (visibleCards.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, visibleCards.length - 1));
    set({ currentIndex: clampedIndex, isFlipped: false });
  },

  flip: () => set((state) => ({ isFlipped: !state.isFlipped })),

  resetFlip: () => set({ isFlipped: false }),

  hide: (index) => {
    const { cards, currentIndex } = get();
    const visibleCards = getVisibleCards(cards);
    if (index < 0 || index >= visibleCards.length) return;

    const cardToHide = visibleCards[index];
    if (!cardToHide) return;

    // Find the actual index in the full cards array
    const actualIndex = cards.findIndex((c) => c === cardToHide);
    if (actualIndex === -1) return;

    const newCards = [...cards];
    newCards[actualIndex] = { ...newCards[actualIndex]!, visible: false };

    // Adjust currentIndex if needed
    const newVisibleCards = getVisibleCards(newCards);
    let newCurrentIndex = currentIndex;
    if (newVisibleCards.length === 0) {
      newCurrentIndex = 0;
    } else if (currentIndex >= newVisibleCards.length) {
      newCurrentIndex = newVisibleCards.length - 1;
    }

    set({ cards: newCards, currentIndex: newCurrentIndex, isFlipped: false });
  },

  show: (index) => {
    const { cards } = get();
    if (index < 0 || index >= cards.length) return;

    const newCards = [...cards];
    newCards[index] = { ...newCards[index]!, visible: true };
    set({ cards: newCards });
  },

  toggleVisible: (index) => {
    const { cards } = get();
    if (index < 0 || index >= cards.length) return;

    const card = cards[index];
    if (!card) return;

    if (card.visible) {
      // Use hide logic for visible cards (operates on visible index)
      const visibleCards = getVisibleCards(cards);
      const visibleIndex = visibleCards.findIndex((c) => c === card);
      if (visibleIndex !== -1) {
        get().hide(visibleIndex);
      }
    } else {
      get().show(index);
    }
  },

  setExpandedContexts: (cardIndex, count) =>
    set((state) => ({
      expandedContexts: { ...state.expandedContexts, [cardIndex]: count },
    })),
}));

// Selectors
export const selectVisibleCards = (state: FlashcardsState) => getVisibleCards(state.cards);

export const selectCurrentCard = (state: FlashcardsState) => {
  const visibleCards = selectVisibleCards(state);
  return visibleCards[state.currentIndex] ?? null;
};

export const selectTotalVisible = (state: FlashcardsState) => selectVisibleCards(state).length;
