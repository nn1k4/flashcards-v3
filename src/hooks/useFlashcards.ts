import { useCallback, useMemo } from 'react';
import { config } from '../config';
import {
  selectCurrentCard,
  selectTotalVisible,
  selectVisibleCards,
  useFlashcardsStore,
} from '../stores/flashcardsStore';
import type { Flashcard } from '../types/dto';

export interface UseFlashcardsReturn {
  // Current state
  currentCard: Flashcard | null;
  currentIndex: number;
  totalVisible: number;
  isFlipped: boolean;

  // Navigation
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;

  // Actions
  flip: () => void;
  hide: () => void;

  // Contexts
  visibleContextsCount: number;
  canExpandContexts: boolean;
  expandContexts: () => void;

  // Data management
  setCards: (cards: Flashcard[]) => void;
  visibleCards: Flashcard[];
}

/**
 * Headless hook for flashcard navigation and state management.
 * Connects to Zustand store and provides a clean API for UI components.
 */
export function useFlashcards(): UseFlashcardsReturn {
  const currentCard = useFlashcardsStore(selectCurrentCard);
  const currentIndex = useFlashcardsStore((s) => s.currentIndex);
  const totalVisible = useFlashcardsStore(selectTotalVisible);
  const isFlipped = useFlashcardsStore((s) => s.isFlipped);
  const expandedContexts = useFlashcardsStore((s) => s.expandedContexts);
  const visibleCards = useFlashcardsStore(selectVisibleCards);

  const storeNext = useFlashcardsStore((s) => s.next);
  const storePrev = useFlashcardsStore((s) => s.prev);
  const storeGoTo = useFlashcardsStore((s) => s.goTo);
  const storeFlip = useFlashcardsStore((s) => s.flip);
  const storeHide = useFlashcardsStore((s) => s.hide);
  const storeSetCards = useFlashcardsStore((s) => s.setCards);
  const storeSetExpandedContexts = useFlashcardsStore((s) => s.setExpandedContexts);

  // Get contexts config
  const { default: defaultContexts, max: maxContexts } = config.flashcards.contexts;

  // Calculate visible contexts count for current card
  const visibleContextsCount = useMemo(() => {
    return expandedContexts[currentIndex] ?? defaultContexts;
  }, [expandedContexts, currentIndex, defaultContexts]);

  // Can expand if current card has more contexts than currently shown
  const canExpandContexts = useMemo(() => {
    if (!currentCard) return false;
    const currentCount = visibleContextsCount;
    const totalContexts = currentCard.contexts.length;
    return currentCount < Math.min(totalContexts, maxContexts);
  }, [currentCard, visibleContextsCount, maxContexts]);

  // Actions
  const next = useCallback(() => storeNext(), [storeNext]);
  const prev = useCallback(() => storePrev(), [storePrev]);
  const goTo = useCallback((index: number) => storeGoTo(index), [storeGoTo]);
  const flip = useCallback(() => storeFlip(), [storeFlip]);

  const hide = useCallback(() => {
    storeHide(currentIndex);
  }, [storeHide, currentIndex]);

  const expandContexts = useCallback(() => {
    if (!currentCard) return;
    const currentCount = visibleContextsCount;
    const totalContexts = currentCard.contexts.length;
    const newCount = Math.min(currentCount + 1, totalContexts, maxContexts);
    storeSetExpandedContexts(currentIndex, newCount);
  }, [currentCard, visibleContextsCount, maxContexts, currentIndex, storeSetExpandedContexts]);

  const setCards = useCallback(
    (cards: Flashcard[]) => {
      storeSetCards(cards);
    },
    [storeSetCards],
  );

  return {
    currentCard,
    currentIndex,
    totalVisible,
    isFlipped,
    next,
    prev,
    goTo,
    flip,
    hide,
    visibleContextsCount,
    canExpandContexts,
    expandContexts,
    setCards,
    visibleCards,
  };
}
