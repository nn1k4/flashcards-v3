import { useRenderBanners } from '../../hooks/useErrorBanners';
import { useI18n } from '../../stores/i18nStore';

export default function ErrorBanners() {
  const { locale } = useI18n();
  const banners = useRenderBanners(locale);
  if (!banners.length) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(720px,95vw)]">
      {banners.map((b) => (
        <div
          key={b.id}
          role="alert"
          className="border border-red-300 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100 dark:border-red-800 rounded px-3 py-2 shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm">{b.text}</span>
            <button
              aria-label="Dismiss"
              className="text-xs underline opacity-80 hover:opacity-100"
              onClick={b.remove}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
