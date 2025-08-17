// src/utils/retry.ts
// Retry-утилиты: экспоненциальный backoff + простая очередь ретраев.
// Реализация минимальная, совместима с планом; позже можно углубить.

import { isRetryableError } from '../api/client';

export type RetryConfig = {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10_000,
  backoffFactor: 2,
  jitter: true,
};

/** Экспоненциальный backoff с jitter */
function nextDelay(attempt: number, cfg: RetryConfig): number {
  const exp = cfg.baseDelay * Math.pow(cfg.backoffFactor, attempt - 1);
  const capped = Math.min(exp, cfg.maxDelay);
  if (!cfg.jitter) return capped;
  const jitter = Math.random() * 0.25 + 0.75; // 75%-125%
  return Math.floor(capped * jitter);
}

/** Обёртка retry с backoff и распознаванием retryable-ошибок */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName: string = 'operation'
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastErr: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      // console.debug(`🔄 ${operationName}: attempt ${attempt}/${cfg.maxAttempts}`);
      return await operation();
    } catch (e) {
      lastErr = e;
      if (!isRetryableError(e) || attempt === cfg.maxAttempts) break;
      await new Promise((r) => setTimeout(r, nextDelay(attempt, cfg)));
    }
  }

  throw (lastErr instanceof Error ? lastErr : new Error('withRetry failed'));
}

/**
 * Простейшая очередь ретраев на уровне SID.
 * В текущей реализации мы лишь храним задачи и помечаем их неуспешными (нет отдельного эндпоинта per-SID).
 * Контракт оставлен совместимым: позже можно заменить на реальную отправку.
 */
export class RetryQueue {
  private q: Array<{ sid: number; lv: string; error: Error }> = [];

  enqueue(sid: number, lv: string, error: Error) {
    this.q.push({ sid, lv, error });
  }

  clear() {
    this.q = [];
  }

  async processQueue(
    _batchId: string,
    onSuccess: (sid: number, result: unknown) => void,
    onFailure: (sid: number, error: Error) => void
  ): Promise<void> {
    // Параметр используем, чтобы удовлетворить TS noUnusedParameters даже если успехов нет
    void onSuccess;

    // Пока нет отдельного API для ретрая отдельных SID — считаем все элементы окончательно неуспешными
    for (const item of this.q) {
      onFailure(item.sid, item.error);
    }
    this.clear();
  }
}
