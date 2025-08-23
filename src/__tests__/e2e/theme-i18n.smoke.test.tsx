import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../app/App';
import { I18nProvider } from '../../stores/i18nStore';
import { ThemeProvider } from '../../stores/themeStore';

describe('E2E smoke: language and theme switch', () => {
  it('renders and allows switching language and theme', () => {
    const { getByText, getByLabelText } = render(
      <I18nProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nProvider>,
    );

    // Has title in current locale
    expect(getByText(/Flashcards v3|Флэшкарты v3/)).toBeTruthy();

    // Switch language
    const langSelect = getByLabelText(/Language|Язык/) as HTMLSelectElement;
    fireEvent.change(langSelect, { target: { value: 'ru' } });
    expect(getByText(/Флэшкарты v3/)).toBeTruthy();

    // Switch theme
    const themeSelect = getByLabelText(/Theme|Тема/) as HTMLSelectElement;
    fireEvent.change(themeSelect, { target: { value: 'dark' } });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
