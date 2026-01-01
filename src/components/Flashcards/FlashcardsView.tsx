import { config } from '../../config';
import { useFlashcards } from '../../hooks/useFlashcards';
import { useHotkeys } from '../../hooks/useHotkeys';
import { Card } from './Card';
import './Flashcards.css';
import { Navigation } from './Navigation';

interface FlashcardsViewProps {
  /** Whether hotkeys are enabled (default: true) */
  hotkeysEnabled?: boolean;
}

export function FlashcardsView({ hotkeysEnabled = true }: FlashcardsViewProps) {
  const fc = useFlashcards();
  const { hotkeys } = config.flashcards;

  useHotkeys(
    {
      next: fc.next,
      prev: fc.prev,
      flip: fc.flip,
      hide: fc.hide,
    },
    hotkeys,
    hotkeysEnabled,
  );

  if (!fc.currentCard) {
    return (
      <div className="flashcards-empty">
        <p>No flashcards available</p>
      </div>
    );
  }

  return (
    <div className="flashcards-view">
      <Card
        card={fc.currentCard}
        isFlipped={fc.isFlipped}
        onFlip={fc.flip}
        visibleContextsCount={fc.visibleContextsCount}
        canExpandContexts={fc.canExpandContexts}
        onExpandContexts={fc.expandContexts}
      />
      <Navigation
        current={fc.currentIndex + 1}
        total={fc.totalVisible}
        onPrev={fc.prev}
        onNext={fc.next}
      />
    </div>
  );
}
