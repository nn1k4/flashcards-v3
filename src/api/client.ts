// Заглушка API-клиента для useBatch. Замените реальной реализацией на этапе интеграции.
import type { Manifest } from '../types/manifest';
import type { BatchResultV1 } from '../types/dto';

export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export const apiClient = {
  async submitBatch(_manifest: Manifest): Promise<{ batchId: string }> {
    // Возвращаем фиктивный batchId; реальное поведение реализуется позже.
    return { batchId: 'stub-batch-id' };
  },
  async getBatchResult(_batchId: string): Promise<BatchResultV1> {
    // Сообщаем, что батч ещё обрабатывается — чтобы useBatch делал polling.
    throw new ApiError('Batch is processing', 'BATCH_PROCESSING');
  },
  async cancelBatch(_batchId: string): Promise<void> {
    // Ничего не делаем в заглушке.
    return;
  },
};
