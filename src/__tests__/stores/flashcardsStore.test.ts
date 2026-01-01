import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectCurrentCard,
  selectTotalVisible,
  selectVisibleCards,
  useFlashcardsStore,
} from '../../stores/flashcardsStore';
import type { Flashcard } from '../../types/dto';

const createCard = (base_form: string, visible = true): Flashcard => ({
  base_form,
  base_translation: `${base_form} translation`,
  unit: 'word',
  forms: [{ form: base_form, translation: '', type: '' }],
  contexts: [{ lv: `Context for ${base_form}`, ru: `Контекст для ${base_form}` }],
  visible,
});

describe('flashcardsStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useFlashcardsStore.setState({
      cards: [],
      currentIndex: 0,
      isFlipped: false,
      expandedContexts: {},
    });
  });

  describe('setCards', () => {
    it('sets cards and resets state', () => {
      const cards = [createCard('mācos'), createCard('eju')];
      useFlashcardsStore.getState().setCards(cards);

      const state = useFlashcardsStore.getState();
      expect(state.cards).toHaveLength(2);
      expect(state.currentIndex).toBe(0);
      expect(state.isFlipped).toBe(false);
      expect(state.expandedContexts).toEqual({});
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      const cards = [createCard('a'), createCard('b'), createCard('c')];
      useFlashcardsStore.getState().setCards(cards);
    });

    it('next increments currentIndex', () => {
      useFlashcardsStore.getState().next();
      expect(useFlashcardsStore.getState().currentIndex).toBe(1);
    });

    it('next does not exceed bounds', () => {
      useFlashcardsStore.getState().goTo(2);
      useFlashcardsStore.getState().next();
      expect(useFlashcardsStore.getState().currentIndex).toBe(2);
    });

    it('prev decrements currentIndex', () => {
      useFlashcardsStore.getState().goTo(2);
      useFlashcardsStore.getState().prev();
      expect(useFlashcardsStore.getState().currentIndex).toBe(1);
    });

    it('prev does not go below zero', () => {
      useFlashcardsStore.getState().prev();
      expect(useFlashcardsStore.getState().currentIndex).toBe(0);
    });

    it('goTo clamps to valid range', () => {
      useFlashcardsStore.getState().goTo(100);
      expect(useFlashcardsStore.getState().currentIndex).toBe(2);

      useFlashcardsStore.getState().goTo(-5);
      expect(useFlashcardsStore.getState().currentIndex).toBe(0);
    });

    it('navigation resets isFlipped to false', () => {
      useFlashcardsStore.getState().flip();
      expect(useFlashcardsStore.getState().isFlipped).toBe(true);

      useFlashcardsStore.getState().next();
      expect(useFlashcardsStore.getState().isFlipped).toBe(false);
    });
  });

  describe('flip', () => {
    it('toggles isFlipped', () => {
      expect(useFlashcardsStore.getState().isFlipped).toBe(false);
      useFlashcardsStore.getState().flip();
      expect(useFlashcardsStore.getState().isFlipped).toBe(true);
      useFlashcardsStore.getState().flip();
      expect(useFlashcardsStore.getState().isFlipped).toBe(false);
    });
  });

  describe('hide/show', () => {
    beforeEach(() => {
      const cards = [createCard('a'), createCard('b'), createCard('c')];
      useFlashcardsStore.getState().setCards(cards);
    });

    it('hide sets visible to false', () => {
      useFlashcardsStore.getState().hide(0);
      const state = useFlashcardsStore.getState();
      expect(state.cards[0]?.visible).toBe(false);
      expect(selectTotalVisible(state)).toBe(2);
    });

    it('hide adjusts currentIndex if needed', () => {
      useFlashcardsStore.getState().goTo(2);
      expect(useFlashcardsStore.getState().currentIndex).toBe(2);

      // Hide the last visible card
      useFlashcardsStore.getState().hide(2);
      // Should clamp to the new last visible index
      expect(useFlashcardsStore.getState().currentIndex).toBe(1);
    });

    it('show sets visible to true', () => {
      const cards = [createCard('a'), createCard('b', false)];
      useFlashcardsStore.getState().setCards(cards);

      useFlashcardsStore.getState().show(1);
      expect(useFlashcardsStore.getState().cards[1]?.visible).toBe(true);
    });
  });

  describe('navigation skips hidden cards', () => {
    it('next/prev operate on visible cards only', () => {
      const cards = [createCard('a'), createCard('b', false), createCard('c')];
      useFlashcardsStore.getState().setCards(cards);

      // Should show 'a' and 'c' only (indices 0 and 1 in visible list)
      const state = useFlashcardsStore.getState();
      expect(selectVisibleCards(state)).toHaveLength(2);
      expect(selectCurrentCard(state)?.base_form).toBe('a');

      useFlashcardsStore.getState().next();
      expect(selectCurrentCard(useFlashcardsStore.getState())?.base_form).toBe('c');
    });
  });

  describe('expandedContexts', () => {
    it('setExpandedContexts updates the count for a card', () => {
      useFlashcardsStore.getState().setExpandedContexts(0, 3);
      expect(useFlashcardsStore.getState().expandedContexts[0]).toBe(3);
    });
  });

  describe('selectors', () => {
    it('selectVisibleCards filters out hidden cards', () => {
      const cards = [createCard('a'), createCard('b', false), createCard('c')];
      useFlashcardsStore.getState().setCards(cards);

      const visible = selectVisibleCards(useFlashcardsStore.getState());
      expect(visible).toHaveLength(2);
      expect(visible[0]?.base_form).toBe('a');
      expect(visible[1]?.base_form).toBe('c');
    });

    it('selectCurrentCard returns correct card', () => {
      const cards = [createCard('a'), createCard('b'), createCard('c')];
      useFlashcardsStore.getState().setCards(cards);
      useFlashcardsStore.getState().goTo(1);

      const current = selectCurrentCard(useFlashcardsStore.getState());
      expect(current?.base_form).toBe('b');
    });

    it('selectCurrentCard returns null when no cards', () => {
      const current = selectCurrentCard(useFlashcardsStore.getState());
      expect(current).toBeNull();
    });

    it('selectTotalVisible returns count of visible cards', () => {
      const cards = [createCard('a'), createCard('b', false), createCard('c')];
      useFlashcardsStore.getState().setCards(cards);

      expect(selectTotalVisible(useFlashcardsStore.getState())).toBe(2);
    });
  });
});
