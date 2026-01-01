import type { Flashcard } from '../../types/dto';
import { highlightForm } from '../../utils/highlightForm';

interface ContextListProps {
  card: Flashcard;
  visibleCount: number;
  canExpand: boolean;
  onExpand: () => void;
}

export function ContextList({ card, visibleCount, canExpand, onExpand }: ContextListProps) {
  const contexts = card.contexts.slice(0, visibleCount);
  const remaining = card.contexts.length - visibleCount;

  if (contexts.length === 0) {
    return <p className="no-contexts">No contexts available</p>;
  }

  return (
    <ul className="context-list">
      {contexts.map((ctx, i) => (
        <li key={i} className="context-item">
          <p className="context-lv">{highlightForm(ctx.lv, card.forms)}</p>
          <p className="context-ru">{ctx.ru}</p>
        </li>
      ))}
      {remaining > 0 && canExpand && (
        <button type="button" className="expand-contexts-btn" onClick={onExpand}>
          +{remaining} more
        </button>
      )}
    </ul>
  );
}
