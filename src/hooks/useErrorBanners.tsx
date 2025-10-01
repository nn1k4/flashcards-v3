/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { ApiError } from '../api/client';
import type { Locale } from '../stores/i18nStore';
import { t } from '../stores/i18nStore';

export type Banner = {
  id: string;
  level: 'error' | 'info';
  messageKey: string; // i18n key
  details?: string;
};

type Ctx = {
  banners: Banner[];
  push: (b: Banner) => void;
  pushFromError: (err: unknown) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const ErrorBannersContext = React.createContext<Ctx | null>(null);

export function ErrorBannersProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = React.useState<Banner[]>([]);

  // Stable callbacks to avoid identity changes and effect loops
  const remove = React.useCallback((id: string) => {
    setBanners((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const clear = React.useCallback(() => {
    setBanners([]);
  }, []);

  const push = React.useCallback((b: Banner) => {
    setBanners((xs) => [b, ...xs]);
  }, []);

  const pushFromError = React.useCallback(
    (err: unknown) => {
      const now = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const be = mapErrorToBanner(err);
      // Avoid writing `details: undefined` under exactOptionalPropertyTypes
      const payload: Banner = { id: now, level: 'error', messageKey: be.key };
      if (be.details !== undefined) (payload as any).details = be.details;
      push(payload);
    },
    [push],
  );

  const value = React.useMemo(
    () => ({ banners, push, pushFromError, remove, clear }),
    [banners, push, pushFromError, remove, clear],
  );

  return <ErrorBannersContext.Provider value={value}>{children}</ErrorBannersContext.Provider>;
}

export function useErrorBanners() {
  const ctx = React.useContext(ErrorBannersContext);
  if (!ctx) throw new Error('ErrorBannersProvider missing');
  return ctx;
}

export function useRenderBanners(locale: Locale) {
  const { banners, remove } = useErrorBanners();
  return banners.map((b) => ({
    id: b.id,
    text: t(locale, b.messageKey),
    remove: () => remove(b.id),
  }));
}

function mapErrorToBanner(err: unknown): { key: string; details?: string } {
  // Default unknown
  const fallback = { key: 'errors.unknown' };
  if (!err) return fallback;
  const e = err as Partial<ApiError> & { status?: number };
  // ApiError.code mapping
  switch (e.code) {
    case 'RATE_LIMIT':
      return { key: 'errors.rate_limited' };
    case 'REQUEST_TOO_LARGE':
      return { key: 'errors.request_too_large' };
    case 'OVERLOADED':
      return { key: 'errors.overloaded' };
    case 'SERVER_ERROR':
      return { key: 'errors.server_error' };
    case 'NETWORK_ERROR':
      return { key: 'errors.network_down' };
    case 'PROXY_DOWN':
      return { key: 'errors.proxy_down' };
    case 'EXPIRED':
      return { key: 'errors.expired' };
    case 'BATCH_NOT_FOUND':
      return { key: 'errors.batch_not_found' };
    case 'TIMEOUT':
      return { key: 'errors.timeout' };
    default:
      break;
  }
  // Fallback by status
  const s = e.status ?? 0;
  // Provider-specific helpful messages
  if (s === 501) return { key: 'errors.provider_disabled' };
  if (s === 401 || s === 403) return { key: 'errors.provider_auth' };
  if (s === 429) return { key: 'errors.rate_limited' };
  if (s === 413) return { key: 'errors.request_too_large' };
  if (s === 529) return { key: 'errors.overloaded' };
  if (s >= 500) return { key: 'errors.server_error' };
  return fallback;
}
