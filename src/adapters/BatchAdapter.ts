import { apiClient } from '../api/client';
import type { BatchResultV1 } from '../types/dto';
import type { Manifest } from '../types/manifest';

export class BatchAdapter {
  constructor(private client = apiClient) {}

  async submit(manifest: Manifest): Promise<{ batchId: string; estimatedTime?: number }> {
    return this.client.submitBatch(manifest);
  }

  async status(batchId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    return this.client.getBatchStatus(batchId);
  }

  async result(batchId: string): Promise<BatchResultV1> {
    return this.client.getBatchResult(batchId);
  }

  async cancel(batchId: string): Promise<void> {
    await this.client.cancelBatch(batchId);
  }
}
