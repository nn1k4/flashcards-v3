// src/utils/retry.ts
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

function nextDelay(attempt: number, cfg: RetryConfig): number {
  const exp = cfg.baseDelay * Math.pow(cfg.backoffFactor, attempt - 1);
  const capped = Math.min(exp, cfg.maxDelay);
  if (!cfg.jitter) return capped;
  const jitter = Math.random() * 0.25 + 0.75;
  return Math.floor(capped * jitter);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName: string = 'operation',
): Promise<T> {
  // Удовлетворяем noUnusedParameters, не меняя поведения
  void operationName;

  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastErr: unknown;

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastErr = e;
      if (!isRetryableError(e) || attempt === cfg.maxAttempts) break;
      await new Promise((r) => setTimeout(r, nextDelay(attempt, cfg)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('withRetry failed');
}

export class RetryQueue {
  private q: Array<{ sid: number; lv: string; error: Error }> = [];

  enqueue(sid: number, lv: string, error: Error) {
    this.q.push({ sid, lv, error });
  }

  clear() {
    this.q = [];
  }

  /**
   * Обрабатывает очередь ретраев «split‑retry»: для каждого SID вызывает `retryOne`.
   *
   * Замечания:
   * - Функция `retryOne` инжектируется снаружи (адаптер/оркестратор) — это облегчает тестирование
   *   и не требует сетевых вызовов в этом модуле.
   * - Ошибка отдельного SID не прерывает очередь.
   */
  async processQueue(
    batchId: string,
    retryOne: (sid: number, lv: string, batchId: string) => Promise<unknown>,
    onSuccess: (sid: number, result: unknown) => void,
    onFailure: (sid: number, error: Error) => void,
  ): Promise<void> {
    for (const item of this.q) {
      try {
        const result = await retryOne(item.sid, item.lv, batchId);
        onSuccess(item.sid, result);
      } catch (e) {
        onFailure(item.sid, (e as Error) ?? item.error);
      }
    }
    this.clear();
  }
}
