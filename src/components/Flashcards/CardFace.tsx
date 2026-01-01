import type { Flashcard } from '../../types/dto';
import { ContextList } from './ContextList';

interface CardFaceProps {
  side: 'front' | 'back';
  card: Flashcard;
  visibleContextsCount: number;
  canExpandContexts: boolean;
  onExpandContexts: () => void;
}

export function CardFace({
  side,
  card,
  visibleContextsCount,
  canExpandContexts,
  onExpandContexts,
}: CardFaceProps) {
  if (side === 'front') {
    return (
      <div className="card-face card-front">
        <h2 className="card-title">{card.base_form}</h2>
        <span className="unit-badge">{card.unit}</span>
      </div>
    );
  }

  return (
    <div className="card-face card-back">
      <h2 className="card-title">{card.base_translation ?? '—'}</h2>
      <ContextList
        card={card}
        visibleCount={visibleContextsCount}
        canExpand={canExpandContexts}
        onExpand={onExpandContexts}
      />
    </div>
  );
}
