// src/api/client.ts
// HTTP-клиент для батч-пайплайна (Manifest-First / Strict Contracts)
// - Безопасные таймауты/отмена (AbortController)
// - Явные коды ошибок и признак retryable
// - Жёсткая Zod-валидация результата (ZBatchResultV1)
// - Поддержка модели через заголовок X-LLM-Model (значение берём из конфигурации llm.defaultModel)
// - Обратная совместимость по форме тела: { manifest }

import { config as appConfig } from '../config';
import { ZBatchResultV1, type BatchResultV1 } from '../types/dto';
import type { Manifest } from '../types/manifest';

// -----------------------------
// Ошибки и помощники по ошибкам
// -----------------------------
export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;

  constructor(
    message: string,
    code: string,
    retryable = false,
    status?: number,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
    if (status !== undefined) this.status = status;
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
  }
}

export class SchemaValidationError extends ApiError {
  raw?: unknown;
  constructor(message: string, raw?: unknown) {
    super(message, 'SCHEMA_INVALID', false);
    this.raw = raw;
  }
}

function isLikeNetworkError(err: unknown): boolean {
  // fetch в браузерах в случае сетевой ошибки кидает TypeError
  return err instanceof TypeError && String(err.message).toLowerCase().includes('fetch');
}

function mapHttpError(res: Response, baseMessage: string, code: string): ApiError {
  const status = res.status;

  // 429 — rate limit (ретраибельно)
  if (status === 429) {
    return new ApiError(`${baseMessage}: ${status} ${res.statusText}`, 'RATE_LIMIT', true, status);
  }

  // 413 — request too large (неретраибельно)
  if (status === 413) {
    return new ApiError(
      `${baseMessage}: ${status} ${res.statusText}`,
      'REQUEST_TOO_LARGE',
      false,
      status,
    );
  }

  // 529 — overloaded (ретраибельно)
  if (status === 529) {
    return new ApiError(`${baseMessage}: ${status} ${res.statusText}`, 'OVERLOADED', true, status);
  }

  // 5xx — ретраибельно
  if (status >= 500) {
    return new ApiError(
      `${baseMessage}: ${status} ${res.statusText}`,
      'SERVER_ERROR',
      true,
      status,
    );
  }

  // Остальные — как есть (обычно неретраибельно)
  return new ApiError(`${baseMessage}: ${status} ${res.statusText}`, code, false, status);
}

// -----------------------------
// Клиент
// -----------------------------
type ClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  model?: string; // по умолчанию берём из config.llm.defaultModel
};

class LlmApiClient {
  private baseUrl: string;
  private timeout: number;
  private model: string;

  constructor(cfg: ClientConfig = {}) {
    const envBase =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '/api';

    const netCfg = appConfig.network;
    const llmCfg = appConfig.llm;
    this.baseUrl = String(cfg.baseUrl ?? envBase ?? netCfg.apiBaseUrl).replace(/\/+$/, '');
    this.timeout = Math.max(1000, (cfg.timeoutMs ?? netCfg.requestTimeoutMs) | 0);
    this.model = cfg.model ?? llmCfg.defaultModel;
  }

  // Конфигурация
  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }
  getBaseUrl() {
    return this.baseUrl;
  }

  setTimeout(ms: number) {
    this.timeout = Math.max(1000, ms | 0);
  }
  getTimeout() {
    return this.timeout;
  }

  setModel(model: string) {
    this.model = model;
  }
  getModel() {
    return this.model;
  }

  // -----------------------------
  // Публичные методы
  // -----------------------------

  /**
   * Health pre-flight as per TRS §8. Uses healthTimeoutMs from config.
   */
  async getHealth(): Promise<{ ok: boolean }> {
    try {
      const url = `${this.baseUrl}/health`;
      const res = await this.fetchWithTimeout(url, {}, appConfig.network.healthTimeoutMs);
      if (!res.ok) throw mapHttpError(res, 'Health check failed', 'PROXY_DOWN');
      return (await this.safeJson(res)) as { ok: boolean };
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (isLikeNetworkError(err)) {
        throw new ApiError('Network error during health check', 'NETWORK_ERROR', true);
      }
      if ((err as any)?.name === 'AbortError') throw err as any;
      throw new ApiError(
        `Unexpected health error: ${err instanceof Error ? err.message : String(err)}`,
        'UNKNOWN_ERROR',
        false,
      );
    }
  }

  /**
   * Отправка батча на сервер.
   * Тело запроса сохраняем совместимым: { manifest }.
   * Модель передаем неинвазивно в заголовке X-LLM-Model (сервер может игнорировать).
   */
  async submitBatch(manifest: Manifest): Promise<{ batchId: string; estimatedTime?: number }> {
    try {
      const routeBase = appConfig.network.llmRouteBase;
      const res = await this.fetchWithTimeout(`${this.baseUrl}${routeBase}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-Model': this.model,
        },
        body: JSON.stringify({ manifest }),
      });

      if (!res.ok) {
        throw mapHttpError(res, 'Submit failed', 'SUBMIT_FAILED');
      }

      const json = await this.safeJson(res);
      const batchId =
        typeof (json as any)?.batchId === 'string' ? (json as any).batchId : undefined;
      if (!batchId || !batchId.trim()) {
        throw new ApiError('Server did not return batchId', 'SUBMIT_INVALID', false, res.status);
      }

      const estimatedTime =
        typeof (json as any)?.estimatedTime === 'number' ? (json as any).estimatedTime : undefined;

      return { batchId, estimatedTime };
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (isLikeNetworkError(err)) {
        throw new ApiError('Network error during submit', 'NETWORK_ERROR', true);
      }
      if ((err as any)?.name === 'AbortError') throw err as any;
      throw new ApiError(
        `Unexpected submit error: ${err instanceof Error ? err.message : String(err)}`,
        'UNKNOWN_ERROR',
        false,
      );
    }
  }

  /**
   * Получение результата батча.
   * Спец-случаи:
   * - 202/204 — ещё обрабатывается (retryable)
   * - 404 — не найдено
   * - 200 с пустым телом — трактуем как processing (retryable)
   * - 200 c не-JSON — ошибка контракта (SchemaValidationError)
   * - 200 c JSON, не проходящим Zod — SchemaValidationError
   */
  async getBatchResult(batchId: string): Promise<BatchResultV1> {
    try {
      const routeBase = appConfig.network.llmRouteBase;
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}${routeBase}/batch/${encodeURIComponent(batchId)}`,
      );

      if (res.status === 202 || res.status === 204) {
        const ra = parseRetryAfter(res.headers.get('Retry-After')) ?? undefined;
        throw new ApiError(
          `Batch ${batchId} is still processing`,
          'BATCH_PROCESSING',
          true,
          res.status,
          ra,
        );
      }
      if (res.status === 404) {
        throw new ApiError(`Batch ${batchId} not found`, 'BATCH_NOT_FOUND', false, 404);
      }
      if (res.status === 410) {
        throw new ApiError(`Batch ${batchId} expired`, 'EXPIRED', false, 410);
      }
      if (!res.ok) {
        throw mapHttpError(res, 'Failed to get batch result', 'GET_FAILED');
      }

      const rawText = await this.readTextSafely(res);
      if (!rawText.trim()) {
        // Пустое тело при 200: считаем, что сервер ещё готовит результат
        throw new ApiError(
          `Batch ${batchId} has no content yet`,
          'BATCH_PROCESSING',
          true,
          res.status,
        );
      }

      let raw: unknown;
      try {
        raw = JSON.parse(rawText);
      } catch {
        throw new SchemaValidationError('Invalid JSON in batch result', rawText);
      }

      try {
        return ZBatchResultV1.parse(raw);
      } catch (e) {
        throw new SchemaValidationError('Invalid batch result format', e);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (isLikeNetworkError(err)) {
        throw new ApiError('Network error while fetching result', 'NETWORK_ERROR', true);
      }
      throw new ApiError(
        `Unexpected result error: ${err instanceof Error ? err.message : String(err)}`,
        'UNKNOWN_ERROR',
        false,
      );
    }
  }

  /**
   * Получение статуса батча (для удобного polling UI).
   * Возвращает статус + опциональный прогресс/ошибку.
   */
  async getBatchStatus(batchId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    const routeBase = appConfig.network.llmRouteBase;
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}${routeBase}/batch/${encodeURIComponent(batchId)}/status`,
    );
    if (!res.ok) {
      throw mapHttpError(res, 'Failed to get batch status', 'STATUS_FAILED');
    }
    return this.safeJson(res) as Promise<{
      status: 'pending' | 'processing' | 'completed' | 'failed';
      progress?: number;
      error?: string;
    }>;
  }

  /**
   * Отмена батча. 404 трактуем как «уже нет/не существует» — не считаем ошибкой.
   */
  async cancelBatch(batchId: string): Promise<void> {
    const routeBase = appConfig.network.llmRouteBase;
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}${routeBase}/batch/${encodeURIComponent(batchId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 404) {
      throw mapHttpError(res, 'Failed to cancel batch', 'CANCEL_FAILED');
    }
  }

  // -----------------------------
  // Внутренние помощники
  // -----------------------------

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    overrideTimeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = Math.max(100, overrideTimeoutMs ?? this.timeout);
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeout}ms`, 'TIMEOUT', true);
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  /** Безопасное чтение текста, учитывая возможные прокси-особенности. */
  private async readTextSafely(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      // Редкий кейс: поток уже прочитан/закрыт прокси — трактуем как пустое тело
      return '';
    }
  }

  /** Безопасный JSON: при пустом теле вернёт {} (кроме тех мест, где мы интерпретируем пустое как processing). */
  private async safeJson<T = unknown>(res: Response): Promise<T> {
    const txt = await this.readTextSafely(res);
    if (!txt.trim()) return {} as T;
    try {
      return JSON.parse(txt) as T;
    } catch {
      throw new SchemaValidationError('Invalid JSON body', txt);
    }
  }
}

// Экземпляр по умолчанию
export const apiClient = new LlmApiClient();

// Утилиты для retry/UX
export const isRetryableError = (error: unknown): boolean =>
  error instanceof ApiError && error.retryable;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Релевантные типы
export type { BatchResultV1 };

// Retry-After parsing helper (RFC 7231 seconds or HTTP date)
export function parseRetryAfter(h?: string | null): number | null {
  if (!h) return null;
  const sec = Number(h);
  if (Number.isFinite(sec)) return Math.max(0, sec * 1000);
  const dt = Date.parse(h);
  return Number.isFinite(dt) ? Math.max(0, dt - Date.now()) : null;
}
