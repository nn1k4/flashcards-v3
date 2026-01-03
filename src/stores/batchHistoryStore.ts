// src/stores/batchHistoryStore.ts
// Zustand store for batch history management
// Shows last 10 batches with status, allows cancellation

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BatchStatus = 'pending' | 'in_progress' | 'ended' | 'canceling' | 'failed';

export interface BatchHistoryItem {
  id: string;
  name: string;
  status: BatchStatus;
  createdAt: string;
  endedAt?: string;
  requestCounts?: {
    total: number;
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  manifestItemCount: number;
  error?: string;
}

interface BatchHistoryState {
  items: BatchHistoryItem[];

  // Actions
  addBatch: (batch: Omit<BatchHistoryItem, 'createdAt'> & { createdAt?: string }) => void;
  updateBatch: (id: string, updates: Partial<BatchHistoryItem>) => void;
  removeBatch: (id: string) => void;
  clearHistory: () => void;
}

const MAX_HISTORY_ITEMS = 10;

export const useBatchHistoryStore = create<BatchHistoryState>()(
  persist(
    (set) => ({
      items: [],

      addBatch: (batch) =>
        set((state) => {
          const newItem: BatchHistoryItem = {
            ...batch,
            createdAt: batch.createdAt || new Date().toISOString(),
          };
          // Add at the beginning, keep only last MAX_HISTORY_ITEMS
          const updated = [newItem, ...state.items].slice(0, MAX_HISTORY_ITEMS);
          console.log(`[BatchHistory] Added batch ${batch.id}, total: ${updated.length}`);
          return { items: updated };
        }),

      updateBatch: (id, updates) =>
        set((state) => {
          const updated = state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item,
          );
          console.log(`[BatchHistory] Updated batch ${id}:`, updates);
          return { items: updated };
        }),

      removeBatch: (id) =>
        set((state) => {
          const updated = state.items.filter((item) => item.id !== id);
          console.log(`[BatchHistory] Removed batch ${id}, remaining: ${updated.length}`);
          return { items: updated };
        }),

      clearHistory: () => {
        console.log('[BatchHistory] Cleared all history');
        return set({ items: [] });
      },
    }),
    {
      name: 'batch-history',
      version: 1,
    },
  ),
);

// Selectors
export const selectPendingBatches = (state: BatchHistoryState) =>
  state.items.filter((b) => b.status === 'pending' || b.status === 'in_progress');

export const selectCompletedBatches = (state: BatchHistoryState) =>
  state.items.filter((b) => b.status === 'ended');

export const selectFailedBatches = (state: BatchHistoryState) =>
  state.items.filter((b) => b.status === 'failed');

export const selectActiveBatch = (state: BatchHistoryState) =>
  state.items.find((b) => b.status === 'pending' || b.status === 'in_progress');
