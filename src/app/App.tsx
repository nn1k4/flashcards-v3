/** Главный каркас приложения.
 *  Далее сюда добавим TextInput/ProcessingView/ContentView по плану.
 */
import { useI18n } from '../stores/i18nStore';
import { useTheme } from '../stores/themeStore';

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 rounded-xl shadow bg-white dark:bg-neutral-900 dark:text-neutral-50">
        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <p className="text-sm opacity-80 mt-1">{t('app.subtitle')}</p>

        <div className="mt-4 flex gap-4">
          <div>
            <label htmlFor="lang" className="block text-xs opacity-70 mb-1">
              {t('ui.language')}
            </label>
            <select
              id="lang"
              className="border rounded p-1 bg-white dark:bg-neutral-800"
              value={locale}
              onChange={(e) => setLocale(e.target.value as any)}
            >
              <option value="en">EN</option>
              <option value="ru">RU</option>
            </select>
          </div>
          <div>
            <label htmlFor="theme" className="block text-xs opacity-70 mb-1">
              {t('ui.theme')}
            </label>
            <select
              id="theme"
              className="border rounded p-1 bg-white dark:bg-neutral-800"
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
            >
              <option value="light">{t('theme.light')}</option>
              <option value="dark">{t('theme.dark')}</option>
              <option value="system">{t('theme.system')}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
