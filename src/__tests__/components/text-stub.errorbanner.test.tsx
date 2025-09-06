import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError } from '../../api/client';
import App from '../../app/App';
import { ErrorBannersProvider } from '../../hooks/useErrorBanners';
import { I18nProvider } from '../../stores/i18nStore';
import { ThemeProvider } from '../../stores/themeStore';

describe('TextStub → failed polling shows ErrorBanner (S2)', () => {
  it('pushes banner on polling failure', async () => {
    const spyHealth = vi.spyOn(apiClient, 'getHealth').mockResolvedValue({ ok: true } as any);
    const spySubmit = vi
      .spyOn(apiClient, 'submitBatch')
      .mockResolvedValue({ batchId: 'b-1' } as any);
    const spyResult = vi
      .spyOn(apiClient, 'getBatchResult')
      .mockRejectedValue(new ApiError('Not found', 'BATCH_NOT_FOUND', false, 404));

    render(
      <I18nProvider>
        <ThemeProvider>
          <ErrorBannersProvider>
            <App />
          </ErrorBannersProvider>
        </ThemeProvider>
      </I18nProvider>,
    );

    const submitBtn = await screen.findByLabelText('Submit Text');
    fireEvent.click(submitBtn);

    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    // cleanup spies
    spyHealth.mockRestore();
    spySubmit.mockRestore();
    spyResult.mockRestore();
  });
});
