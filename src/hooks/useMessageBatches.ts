// src/hooks/useMessageBatches.ts
// Hook for managing official Message Batches API interactions
// Provides 50% cost savings via async batch processing

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageBatch, MessageBatchResult } from '../api/client';
import { apiClient, ApiError } from '../api/client';
import { config as appConfig } from '../config';
import { useBatchHistoryStore } from '../stores/batchHistoryStore';
import type { Flashcard } from '../types/dto';
import type { Manifest } from '../types/manifest';
import { pickAdaptiveDelay } from './useBatch';
import { useErrorBanners } from './useErrorBanners';

interface UseMessageBatchesReturn {
  // State
  currentBatch: MessageBatch | null;
  isProcessing: boolean;
  isComplete: boolean;
  isFailed: boolean;
  error: string | null;
  progress: number;

  // Results
  flashcards: Flashcard[];

  // Actions
  submitBatch: (manifest: Manifest, name?: string) => Promise<void>;
  cancelBatch: () => Promise<void>;
  reset: () => void;
}

/**
 * Extract flashcards from batch results
 */
function extractFlashcardsFromResults(results: MessageBatchResult[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const entry of results) {
    if (entry.result.type !== 'succeeded') {
      console.log(`[useMessageBatches] Skipping ${entry.custom_id}: ${entry.result.type}`);
      continue;
    }

    const content = entry.result.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'emit_flashcards') {
        const input = block.input as { flashcards?: Flashcard[] };
        if (Array.isArray(input?.flashcards)) {
          console.log(
            `[useMessageBatches] Extracted ${input.flashcards.length} cards from ${entry.custom_id}`,
          );
          cards.push(...input.flashcards);
        }
      }
    }

    // Log usage for cache monitoring
    if (entry.result.message?.usage) {
      const usage = entry.result.message.usage;
      console.log(
        `[useMessageBatches] ${entry.custom_id} usage: input=${usage.input_tokens}, output=${usage.output_tokens}`,
      );
      if (usage.cache_creation_input_tokens) {
        console.log(
          `[useMessageBatches]   Cache created: ${usage.cache_creation_input_tokens} tokens`,
        );
      }
      if (usage.cache_read_input_tokens) {
        console.log(`[useMessageBatches]   Cache hit: ${usage.cache_read_input_tokens} tokens`);
      }
    }
  }

  return cards;
}

export function useMessageBatches(): UseMessageBatchesReturn {
  const { pushFromError } = useErrorBanners();
  const { addBatch, updateBatch } = useBatchHistoryStore();

  const [currentBatch, setCurrentBatch] = useState<MessageBatch | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate progress from request counts
  const progress = currentBatch?.requestCounts
    ? (currentBatch.requestCounts.succeeded + currentBatch.requestCounts.errored) /
      Math.max(1, currentBatch.requestCounts.total)
    : 0;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Poll batch status
  const pollBatch = useCallback(
    async (batchId: string, startTime: number) => {
      if (abortRef.current?.signal.aborted) return;

      try {
        console.log(`[useMessageBatches] Polling batch ${batchId}...`);
        const batch = await apiClient.getMessageBatch(batchId);

        setCurrentBatch(batch);

        if (batch.status === 'ended') {
          console.log(`[useMessageBatches] Batch ${batchId} completed!`);
          console.log(`[useMessageBatches]   Succeeded: ${batch.requestCounts.succeeded}`);
          console.log(`[useMessageBatches]   Errored: ${batch.requestCounts.errored}`);

          cleanup();
          setIsProcessing(false);
          setIsComplete(true);

          // Extract flashcards from results
          if (batch.results) {
            const cards = extractFlashcardsFromResults(batch.results);
            console.log(`[useMessageBatches] Total flashcards extracted: ${cards.length}`);
            setFlashcards(cards);
          }

          // Update history
          updateBatch(batchId, {
            status: 'ended',
            ...(batch.endedAt && { endedAt: batch.endedAt }),
            requestCounts: batch.requestCounts,
          });
        }
      } catch (e) {
        if (e instanceof ApiError && e.code === 'BATCH_PROCESSING') {
          // Still processing, schedule next poll
          const delay = pickAdaptiveDelay(Date.now() - startTime);
          console.log(`[useMessageBatches] Batch still processing, next poll in ${delay}ms`);

          pollTimeoutRef.current = setTimeout(() => {
            pollBatch(batchId, startTime);
          }, delay);
          return;
        }

        // Error occurred
        console.error(`[useMessageBatches] Poll error:`, e);
        cleanup();
        setIsProcessing(false);
        setIsFailed(true);
        setError(e instanceof Error ? e.message : String(e));
        updateBatch(batchId, { status: 'failed', error: String(e) });
        pushFromError(e);
      }
    },
    [cleanup, updateBatch, pushFromError],
  );

  // Submit a new batch
  const submitBatch = useCallback(
    async (manifest: Manifest, name?: string) => {
      cleanup();
      setCurrentBatch(null);
      setIsProcessing(true);
      setIsComplete(false);
      setIsFailed(false);
      setError(null);
      setFlashcards([]);

      abortRef.current = new AbortController();
      const startTime = Date.now();

      try {
        // Pre-flight health check
        console.log('[useMessageBatches] Health check...');
        await apiClient.getHealth();

        // Create batch
        console.log(`[useMessageBatches] Creating batch with ${manifest.items.length} items`);
        const batch = await apiClient.createMessageBatch(manifest);
        console.log(`[useMessageBatches] Batch created: ${batch.batchId}`);
        console.log(`[useMessageBatches] Status: ${batch.status}`);

        setCurrentBatch(batch);

        // Add to history
        addBatch({
          id: batch.batchId,
          name: name || `Batch ${new Date().toLocaleTimeString()}`,
          status: 'in_progress',
          manifestItemCount: manifest.items.length,
          requestCounts: batch.requestCounts,
        });

        // Start polling
        const delay = appConfig.batch.polling.stages[0]?.minMs || 1000;
        console.log(`[useMessageBatches] Starting polling in ${delay}ms...`);
        pollTimeoutRef.current = setTimeout(() => {
          pollBatch(batch.batchId, startTime);
        }, delay);
      } catch (e) {
        console.error('[useMessageBatches] Submit error:', e);
        cleanup();
        setIsProcessing(false);
        setIsFailed(true);
        setError(e instanceof Error ? e.message : String(e));
        pushFromError(e);
      }
    },
    [cleanup, addBatch, pollBatch, pushFromError],
  );

  // Cancel the current batch
  const cancelBatch = useCallback(async () => {
    if (!currentBatch) return;

    try {
      console.log(`[useMessageBatches] Canceling batch ${currentBatch.batchId}`);
      await apiClient.cancelMessageBatch(currentBatch.batchId);
      cleanup();
      setIsProcessing(false);
      updateBatch(currentBatch.batchId, { status: 'canceling' });
    } catch (e) {
      console.error('[useMessageBatches] Cancel error:', e);
      pushFromError(e);
    }
  }, [currentBatch, cleanup, updateBatch, pushFromError]);

  // Reset state
  const reset = useCallback(() => {
    cleanup();
    setCurrentBatch(null);
    setIsProcessing(false);
    setIsComplete(false);
    setIsFailed(false);
    setError(null);
    setFlashcards([]);
  }, [cleanup]);

  return {
    currentBatch,
    isProcessing,
    isComplete,
    isFailed,
    error,
    progress,
    flashcards,
    submitBatch,
    cancelBatch,
    reset,
  };
}
