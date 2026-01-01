import clsx from 'clsx';
import type { CSSProperties, MouseEvent } from 'react';
import { config } from '../../config';
import type { Flashcard } from '../../types/dto';
import { CardFace } from './CardFace';

interface CardProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  visibleContextsCount: number;
  canExpandContexts: boolean;
  onExpandContexts: () => void;
}

export function Card({
  card,
  isFlipped,
  onFlip,
  visibleContextsCount,
  canExpandContexts,
  onExpandContexts,
}: CardProps) {
  const { fontFamily, animation } = config.flashcards;

  const cardStyle: CSSProperties = {
    fontFamily,
    transition: `transform ${animation.duration}ms ${animation.easing}`,
  };

  const handleClick = (e: MouseEvent) => {
    // Don't flip if clicking on expand button
    if ((e.target as HTMLElement).closest('.expand-contexts-btn')) {
      return;
    }
    onFlip();
  };

  return (
    <div
      className="card-container"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Flip card"
    >
      <div className={clsx('card', { 'is-flipped': isFlipped })} style={cardStyle}>
        <CardFace
          side="front"
          card={card}
          visibleContextsCount={visibleContextsCount}
          canExpandContexts={canExpandContexts}
          onExpandContexts={onExpandContexts}
        />
        <CardFace
          side="back"
          card={card}
          visibleContextsCount={visibleContextsCount}
          canExpandContexts={canExpandContexts}
          onExpandContexts={onExpandContexts}
        />
      </div>
    </div>
  );
}
