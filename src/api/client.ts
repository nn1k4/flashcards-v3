// src/api/client.ts
import { ZBatchResultV1, type BatchResultV1 } from '../types/dto';
import type { Manifest } from '../types/manifest';

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status?: number; // опциональное свойство

  constructor(message: string, code: string, retryable = false, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
    // exactOptionalPropertyTypes: присваиваем ТОЛЬКО если число определено
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export class SchemaValidationError extends ApiError {
  raw?: unknown;
  constructor(message: string, raw?: unknown) {
    super(message, 'SCHEMA_INVALID', false);
    this.raw = raw;
  }
}

class ClaudeApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    // Только import.meta.env (браузерный путь). Fallback — '/api' (vite dev proxy).
    const envBase =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '/api';

    this.baseUrl = String(envBase).replace(/\/+$/, '');
    this.timeout = 15_000;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  setTimeout(ms: number) {
    this.timeout = Math.max(1000, ms | 0);
  }

  async submitBatch(manifest: Manifest): Promise<{ batchId: string }> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/claude/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      });

      if (!res.ok) {
        throw new ApiError(
          `Submit failed: ${res.status} ${res.statusText}`,
          'SUBMIT_FAILED',
          res.status >= 500,
          res.status,
        );
      }

      const data = (await res.json()) as { batchId?: string };
      if (!data?.batchId) {
        throw new ApiError('Server did not return batchId', 'SUBMIT_INVALID', false);
      }
      return { batchId: data.batchId };
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (err instanceof TypeError && String(err.message).includes('fetch')) {
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

  async getBatchResult(batchId: string): Promise<BatchResultV1> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/claude/batch/${encodeURIComponent(batchId)}`,
      );

      // 1) Специальные статусы без тела — обрабатываем ДО любых попыток чтения JSON
      if (res.status === 202 || res.status === 204) {
        throw new ApiError(
          `Batch ${batchId} is still processing`,
          'BATCH_PROCESSING',
          true,
          res.status,
        );
      }
      if (res.status === 404) {
        throw new ApiError(`Batch ${batchId} not found`, 'BATCH_NOT_FOUND', false, 404);
      }
      if (!res.ok) {
        throw new ApiError(
          `Failed to get batch result: ${res.status} ${res.statusText}`,
          'GET_FAILED',
          res.status >= 500,
          res.status,
        );
      }

      // 2) Читаем текст тела безопасно: некоторые прокси могут вернуть 200 с пустым телом
      const rawText = await res.text();
      if (!rawText || !rawText.trim()) {
        // трактуем как "ещё обрабатывается" — повторим polling
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
        // Если пришёл не-JSON при 200 — это ошибка контракта
        throw new SchemaValidationError('Invalid JSON in batch result', rawText);
      }

      // 3) Жёсткая Zod-валидация
      try {
        return ZBatchResultV1.parse(raw);
      } catch (e) {
        throw new SchemaValidationError('Invalid batch result format', e);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;

      if (err instanceof TypeError && String(err.message).includes('fetch')) {
        throw new ApiError('Network error while fetching result', 'NETWORK_ERROR', true);
      }

      throw new ApiError(
        `Unexpected result error: ${err instanceof Error ? err.message : String(err)}`,
        'UNKNOWN_ERROR',
        false,
      );
    }
  }
  async getBatchStatus(batchId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/claude/batch/${encodeURIComponent(batchId)}/status`,
    );
    if (!res.ok) {
      throw new ApiError(
        `Failed to get batch status: ${res.status}`,
        'STATUS_FAILED',
        res.status >= 500,
        res.status,
      );
    }
    return res.json();
  }

  async cancelBatch(batchId: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/claude/batch/${encodeURIComponent(batchId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok && res.status !== 404) {
      throw new ApiError(
        `Failed to cancel batch: ${res.status}`,
        'CANCEL_FAILED',
        res.status >= 500,
        res.status,
      );
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${this.timeout}ms`, 'TIMEOUT', true);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const apiClient = new ClaudeApiClient();

export const isRetryableError = (error: unknown): boolean =>
  error instanceof ApiError && error.retryable;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export type { BatchResultV1 };
