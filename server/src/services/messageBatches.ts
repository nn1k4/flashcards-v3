// server/src/services/messageBatches.ts
// Official Message Batches API service with prompt caching support
// Provides 50% cost savings via async batch processing

import Anthropic from '@anthropic-ai/sdk';

// Types
export interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system?: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
    messages: Array<{
      role: 'user' | 'assistant';
      content:
        | string
        | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
    }>;
    tools?: any[];
    tool_choice?: any;
  };
}

export interface BatchJob {
  id: string;
  status: 'in_progress' | 'ended' | 'canceling';
  createdAt: string;
  endedAt?: string;
  resultsUrl?: string;
  requestCounts: {
    total: number;
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
}

export interface BatchResultEntry {
  custom_id: string;
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired';
    message?: {
      id: string;
      type: string;
      role: string;
      content: Array<{ type: string; name?: string; input?: any; text?: string; id?: string }>;
      stop_reason: string;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    error?: { type: string; message: string };
  };
}

// Lazy initialization to avoid errors when API key is not set
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Create a new batch using official Message Batches API
 * Supports prompt caching via cache_control: { type: 'ephemeral' }
 */
export async function createBatch(requests: BatchRequest[]): Promise<BatchJob> {
  const client = getClient();
  console.log(`[MessageBatches] Creating batch with ${requests.length} requests`);
  console.log(
    `[MessageBatches] Request custom_ids: ${requests.map((r) => r.custom_id).join(', ')}`,
  );

  try {
    const batch = await client.messages.batches.create({
      requests: requests.map((r) => ({
        custom_id: r.custom_id,
        params: r.params as any,
      })),
    });

    console.log(`[MessageBatches] Batch created successfully`);
    console.log(`[MessageBatches]   ID: ${batch.id}`);
    console.log(`[MessageBatches]   Status: ${batch.processing_status}`);
    console.log(`[MessageBatches]   Created: ${batch.created_at}`);

    return mapBatchToJob(batch);
  } catch (error: any) {
    console.error(`[MessageBatches] Create batch failed:`, error?.message || error);
    console.error(`[MessageBatches] Error details:`, JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Retrieve batch status
 */
export async function getBatch(batchId: string): Promise<BatchJob> {
  const client = getClient();
  console.log(`[MessageBatches] Retrieving batch: ${batchId}`);

  try {
    const batch = await client.messages.batches.retrieve(batchId);

    console.log(`[MessageBatches] Batch ${batchId}:`);
    console.log(`[MessageBatches]   Status: ${batch.processing_status}`);
    console.log(
      `[MessageBatches]   Progress: ${batch.request_counts.succeeded}/${batch.request_counts.processing + batch.request_counts.succeeded + batch.request_counts.errored} succeeded`,
    );
    console.log(`[MessageBatches]   Errored: ${batch.request_counts.errored}`);

    return mapBatchToJob(batch);
  } catch (error: any) {
    console.error(`[MessageBatches] Retrieve batch failed:`, error?.message || error);
    throw error;
  }
}

/**
 * Get batch results as array (streams JSONL internally)
 */
export async function getBatchResults(batchId: string): Promise<BatchResultEntry[]> {
  const client = getClient();
  console.log(`[MessageBatches] Getting results for batch: ${batchId}`);

  try {
    const results: BatchResultEntry[] = [];
    const stream = await client.messages.batches.results(batchId);

    for await (const entry of stream) {
      // Log each result for debugging
      console.log(`[MessageBatches] Result for ${entry.custom_id}: ${entry.result.type}`);

      if (entry.result.type === 'succeeded' && entry.result.message?.usage) {
        const usage = entry.result.message.usage;
        console.log(
          `[MessageBatches]   Usage: input=${usage.input_tokens}, output=${usage.output_tokens}`,
        );
        if (usage.cache_creation_input_tokens) {
          console.log(
            `[MessageBatches]   Cache created: ${usage.cache_creation_input_tokens} tokens`,
          );
        }
        if (usage.cache_read_input_tokens) {
          console.log(`[MessageBatches]   Cache hit: ${usage.cache_read_input_tokens} tokens`);
        }
      } else if (entry.result.type === 'errored') {
        const err = entry.result.error as { type?: string; message?: string } | undefined;
        console.error(`[MessageBatches]   Error: ${err?.message || err?.type || 'unknown'}`);
      }

      results.push({
        custom_id: entry.custom_id,
        result: entry.result as any,
      });
    }

    console.log(`[MessageBatches] Total results: ${results.length}`);
    console.log(
      `[MessageBatches]   Succeeded: ${results.filter((r) => r.result.type === 'succeeded').length}`,
    );
    console.log(
      `[MessageBatches]   Errored: ${results.filter((r) => r.result.type === 'errored').length}`,
    );

    return results;
  } catch (error: any) {
    console.error(`[MessageBatches] Get results failed:`, error?.message || error);
    throw error;
  }
}

/**
 * Cancel a running batch
 */
export async function cancelBatch(batchId: string): Promise<BatchJob> {
  const client = getClient();
  console.log(`[MessageBatches] Canceling batch: ${batchId}`);

  try {
    const batch = await client.messages.batches.cancel(batchId);

    console.log(`[MessageBatches] Cancel requested for batch ${batchId}`);
    console.log(`[MessageBatches]   New status: ${batch.processing_status}`);

    return mapBatchToJob(batch);
  } catch (error: any) {
    console.error(`[MessageBatches] Cancel batch failed:`, error?.message || error);
    throw error;
  }
}

/**
 * List all batches (paginated)
 */
export async function listBatches(limit = 20): Promise<BatchJob[]> {
  const client = getClient();
  console.log(`[MessageBatches] Listing batches, limit: ${limit}`);

  try {
    const jobs: BatchJob[] = [];

    // The SDK returns an async iterable page
    const page = await client.messages.batches.list({ limit });

    for await (const batch of page) {
      jobs.push(mapBatchToJob(batch));
    }

    console.log(`[MessageBatches] Found ${jobs.length} batches`);
    jobs.forEach((j) => {
      console.log(
        `[MessageBatches]   ${j.id}: ${j.status} (${j.requestCounts.succeeded}/${j.requestCounts.total})`,
      );
    });

    return jobs;
  } catch (error: any) {
    console.error(`[MessageBatches] List batches failed:`, error?.message || error);
    throw error;
  }
}

// Helper to map SDK response to our BatchJob type
function mapBatchToJob(batch: any): BatchJob {
  const counts = batch.request_counts;
  return {
    id: batch.id,
    status: batch.processing_status,
    createdAt: batch.created_at,
    endedAt: batch.ended_at ?? undefined,
    resultsUrl: batch.results_url ?? undefined,
    requestCounts: {
      total:
        counts.processing + counts.succeeded + counts.errored + counts.canceled + counts.expired,
      processing: counts.processing,
      succeeded: counts.succeeded,
      errored: counts.errored,
      canceled: counts.canceled,
      expired: counts.expired,
    },
  };
}
