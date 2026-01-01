interface NavigationProps {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Navigation({ current, total, onPrev, onNext }: NavigationProps) {
  const hasPrev = current > 1;
  const hasNext = current < total;

  return (
    <div className="flashcards-navigation">
      <button
        type="button"
        className="nav-btn nav-prev"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous card"
      >
        &larr;
      </button>
      <span className="nav-indicator">{total > 0 ? `${current} / ${total}` : '0 / 0'}</span>
      <button
        type="button"
        className="nav-btn nav-next"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next card"
      >
        &rarr;
      </button>
    </div>
  );
}
