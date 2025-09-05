import { render, screen } from '@testing-library/react';
import React from 'react';
import ErrorBanners from '../../components/Banners/ErrorBanners';
import { ErrorBannersProvider, useErrorBanners } from '../../hooks/useErrorBanners';
import { I18nProvider } from '../../stores/i18nStore';

function Trigger() {
  const { pushFromError } = useErrorBanners();
  React.useEffect(() => {
    pushFromError({ code: 'RATE_LIMIT' } as any);
  }, [pushFromError]);
  return null;
}

describe('ErrorBanners', () => {
  it('renders i18n banner for rate limit', async () => {
    render(
      <I18nProvider>
        <ErrorBannersProvider>
          <ErrorBanners />
          <Trigger />
        </ErrorBannersProvider>
      </I18nProvider>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders expired banner with correct i18n text', async () => {
    render(
      <I18nProvider>
        <ErrorBannersProvider>
          <ErrorBanners />
          {/* Trigger EXPIRED */}
          <TriggerExpired />
        </ErrorBannersProvider>
      </I18nProvider>,
    );
    // Default locale is en per config/i18n.json
    expect(await screen.findByText('Batch has expired (≥29 days).')).toBeInTheDocument();
  });
});

function TriggerExpired() {
  const { pushFromError } = useErrorBanners();
  React.useEffect(() => {
    pushFromError({ code: 'EXPIRED' } as any);
  }, [pushFromError]);
  return null;
}
