// src/api/client.ts
// Реальный HTTP-клиент с валидацией Zod, таймаутами и явными кодами ошибок.

import { ZBatchResultV1, type BatchResultV1, migrateBatchResult } from '../types/dto';
import type { Manifest } from '../types/manifest';
import { getManifestChunks } from '../utils/manifest';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class SchemaValidationError extends ApiError {
  constructor(message: string, public validationErrors: unknown) {
    super(message, 'SCHEMA_VALIDATION', false);
  }
}

export class ClaudeApiClient {
  constructor(
    private baseUrl: string = '/api',
    private timeout: number = 30_000
  ) {}

  /**
   * Отправка батча на обработку.
   * Формируем payload строго из манифеста (MANIFEST-FIRST).
   */
  async submitBatch(
    manifest: Manifest
  ): Promise<{ batchId: string; estimatedTime?: number }> {
    try {
      const chunks = getManifestChunks(manifest);
      const payload = {
        batchId: manifest.batchId,
        source: manifest.source,
        chunks: chunks.map((chunk) => ({
          chunkIndex: chunk.chunkIndex,
          items: chunk.items.map((it) => ({
            sid: it.sid,
            sig: it.sig,
            text: it.lv,
          })),
        })),
        options: {
          maxSentencesPerChunk: 20,
          model: 'claude-3-sonnet',
          temperature: 0.1,
        },
      };

      const res = await this.fetchWithTimeout(`${this.baseUrl}/claude/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new ApiError(
          `Failed to submit batch: ${res.status} ${res.statusText}`,
          'SUBMIT_FAILED',
          res.status >= 500,
          res.status
        );
      }

      const data: any = await res.json();
      return {
        batchId: data.batchId || manifest.batchId,
        estimatedTime: data.estimatedTime,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Сетевые проблемы
      if (error instanceof TypeError && String(error.message).includes('fetch')) {
        throw new ApiError('Network error: failed to connect to API', 'NETWORK_ERROR', true);
      }

      throw new ApiError(
        `Unexpected error submitting batch: ${error instanceof Error ? error.message : String(error)}`,
        'UNKNOWN_ERROR',
        false
      );
    }
  }

  /**
   * Получение результатов обработки батча c строгой Zod-валидацией.
   * 202 → BATCH_PROCESSING (retryable), 404 → BATCH_NOT_FOUND.
   */
  async getBatchResult(batchId: string): Promise<BatchResultV1> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/claude/batch/${encodeURIComponent(batchId)}`
      );

      if (!res.ok) {
        if (res.status === 404) {
          throw new ApiError(`Batch ${batchId} not found`, 'BATCH_NOT_FOUND', false, 404);
        }
        if (res.status === 202) {
          throw new ApiError(`Batch ${batchId} is still processing`, 'BATCH_PROCESSING', true, 202);
        }
        throw new ApiError(
          `Failed to get batch result: ${res.status} ${res.statusText}`,
          'GET_FAILED',
          res.status >= 500,
          res.status
        );
      }

      const raw = await res.json();

      // Zod-валидация → попытка миграции → ошибка схемы
      try {
        return ZBatchResultV1.parse(raw);
      } catch (validationError) {
        try {
          const migrated = migrateBatchResult(raw);
          if (migrated.schemaVersion === 1) {
            return migrated;
          }
        } catch {
          // миграция не удалась
        }
        throw new SchemaValidationError(
          `Invalid batch result format for ${batchId}`,
          validationError
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (error instanceof TypeError && String(error.message).includes('fetch')) {
        throw new ApiError('Network error: failed to connect to API', 'NETWORK_ERROR', true);
      }

      throw new ApiError(
        `Unexpected error getting batch result: ${error instanceof Error ? error.message : String(error)}`,
        'UNKNOWN_ERROR',
        false
      );
    }
  }

  /**
   * Необязательный эндпоинт статуса (если бэкенд поддерживает).
   */
  async getBatchStatus(batchId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/claude/batch/${encodeURIComponent(batchId)}/status`
      );
      if (!res.ok) {
        throw new ApiError(`Failed to get batch status: ${res.status}`, 'STATUS_FAILED', res.status >= 500);
      }
      return await res.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Error checking batch status: ${error instanceof Error ? error.message : String(error)}`,
        'STATUS_ERROR',
        true
      );
    }
  }

  /**
   * Отмена обработки; 404 трактуем как ок (ничего не обрабатывается).
   */
  async cancelBatch(batchId: string): Promise<void> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.baseUrl}/claude/batch/${encodeURIComponent(batchId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok && res.status !== 404) {
        throw new ApiError(`Failed to cancel batch: ${res.status}`, 'CANCEL_FAILED', res.status >= 500);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        `Error canceling batch: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_ERROR',
        false
      );
    }
  }

  /** fetch с таймаутом */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${this.timeout}ms`, 'TIMEOUT', true);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Глобальный экземпляр клиента
export const apiClient = new ClaudeApiClient();

// Хелперы для retry-логики (используются в utils/retry.ts)
export function isRetryableError(error: unknown): boolean {
  return error instanceof ApiError && error.retryable;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
