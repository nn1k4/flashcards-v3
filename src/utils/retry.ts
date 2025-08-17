// src/utils/retry.ts
// Минимальные retry-утилиты (заглушка). Замените реальным бэком позже.

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number },
  _label?: string
): Promise<T> {
  const max = opts?.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
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

  async processQueue(
    _batchId: string,
    onSuccess: (sid: number, result: unknown) => void,
    onFailure: (sid: number, error: Error) => void
  ): Promise<void> {
    // Чтобы удовлетворить TS noUnusedParameters в заглушке:
    void onSuccess;

    // В заглушке сразу помечаем все элементы как окончательно неуспешные
    for (const item of this.q) {
      onFailure(item.sid, item.error);
    }
    this.clear();
  }
}
