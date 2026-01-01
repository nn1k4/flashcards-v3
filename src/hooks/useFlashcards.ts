import { useCallback, useMemo } from 'react';
import { config } from '../config';
import { useFlashcardsStore } from '../stores/flashcardsStore';
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

// Get stable action references from the store (outside component to avoid re-subscriptions)
const getActions = () => {
  const state = useFlashcardsStore.getState();
  return {
    next: state.next,
    prev: state.prev,
    goTo: state.goTo,
    flip: state.flip,
    hide: state.hide,
    setCards: state.setCards,
    setExpandedContexts: state.setExpandedContexts,
  };
};

/**
 * Headless hook for flashcard navigation and state management.
 * Connects to Zustand store and provides a clean API for UI components.
 */
export function useFlashcards(): UseFlashcardsReturn {
  // Subscribe to primitive state values only (stable references)
  const cards = useFlashcardsStore((s) => s.cards);
  const currentIndex = useFlashcardsStore((s) => s.currentIndex);
  const isFlipped = useFlashcardsStore((s) => s.isFlipped);
  const expandedContexts = useFlashcardsStore((s) => s.expandedContexts);

  // Derive visible cards with useMemo to maintain stable reference
  const visibleCards = useMemo(() => cards.filter((c) => c.visible), [cards]);

  // Derive current card and total from visibleCards
  const currentCard = useMemo(
    () => visibleCards[currentIndex] ?? null,
    [visibleCards, currentIndex],
  );
  const totalVisible = visibleCards.length;

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

  // Stable action wrappers using getState()
  const next = useCallback(() => getActions().next(), []);
  const prev = useCallback(() => getActions().prev(), []);
  const goTo = useCallback((index: number) => getActions().goTo(index), []);
  const flip = useCallback(() => getActions().flip(), []);

  const hide = useCallback(() => {
    getActions().hide(useFlashcardsStore.getState().currentIndex);
  }, []);

  const expandContexts = useCallback(() => {
    const state = useFlashcardsStore.getState();
    const stateVisibleCards = state.cards.filter((c) => c.visible);
    const card = stateVisibleCards[state.currentIndex];
    if (!card) return;
    const ctxConfig = config.flashcards.contexts;
    const currentCount = state.expandedContexts[state.currentIndex] ?? ctxConfig.default;
    const totalContexts = card.contexts.length;
    const newCount = Math.min(currentCount + 1, totalContexts, ctxConfig.max);
    getActions().setExpandedContexts(state.currentIndex, newCount);
  }, []);

  const setCards = useCallback((cards: Flashcard[]) => {
    getActions().setCards(cards);
  }, []);

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
