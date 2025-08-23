import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../stores/themeStore';

describe('theme resolver', () => {
  it('applies dark class when system prefers dark', () => {
    const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any;
    (window as any).matchMedia = vi.fn().mockReturnValue(mql);
    document.documentElement.classList.remove('dark');
    render(
      <ThemeProvider>
        <div>ok</div>
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
