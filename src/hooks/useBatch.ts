// src/hooks/useBatch.ts
// Главный бизнес-хук: оркестрация батч-обработки
// Задачи: submit → polling → aggregate → FSM → retry → finalize
// Принципы: MANIFEST-FIRST, агрегация по SID, строгие контракты, явная FSM

import { useReducer, useCallback, useMemo, useRef, useEffect, useState } from 'react';

// API-клиент и ошибки
import { apiClient, ApiError } from '../api/client';

// FSM: редьюсер состояния батча и селекторы
import {
  batchFSMReducer,
  createInitialBatchState,
  FSMSelectors,
  validateFSMState,
  type BatchFSMState,
} from '../utils/fsm';

// Утилиты агрегации (RU всегда по порядку SID из манифеста)
import {
  aggregateResultsBySid,
  buildRussianTextFromAggregation,
  extractAllFlashcards,
} from '../utils/aggregator';

// Манифест-утилиты (LV только из манифеста)
import { buildLvTextFromManifest, validateManifest } from '../utils/manifest';

// Повторные попытки / очередь ретраев
import { withRetry, RetryQueue } from '../utils/retry';

// Контракты типов
import type { Manifest } from '../types/manifest';
import type { BatchResultV1, Flashcard } from '../types/dto';
import type { ProcessingMetrics } from '../types/core';

// Представление результата для UI
export type BatchResultView = {
  lvText: string;
  ruText: string;
  cards: Flashcard[];
  metrics: ProcessingMetrics;
};

type UseBatchReturn = {
  // состояние
  fsmState: BatchFSMState;
  batchResult: BatchResultView | null;

  // селекторы
  progress: number;
  sidCounts: ReturnType<typeof FSMSelectors.getSidStateCounts>;
  processingTime: number;

  // флаги
  isProcessing: boolean;
  canStart: boolean;
  canCancel: boolean;

  // действия
  startProcessing: () => Promise<void>;
  cancelProcessing: () => Promise<void>;
  reset: () => void;
};

export function useBatch(manifest: Manifest | null): UseBatchReturn {
  // --- FSM состояние батча ---
  const [fsmState, dispatch] = useReducer(
    batchFSMReducer,
    createInitialBatchState(manifest?.items.length || 0, manifest ? getChunksCount(manifest) : 0)
  );

  // --- Актуальный результат для отображения ---
  const [batchResult, setBatchResult] = useState<BatchResultView | null>(null);

  // --- Очередь ретраев и контроллер отмены ---
  const retryQueue = useRef(new RetryQueue());
  const abortController = useRef<AbortController | null>(null);

  // --- Инициализация FSM при смене манифеста ---
  useEffect(() => {
    if (!manifest) return;

    // Жёсткая валидация манифеста перед стартом пайплайна (MANIFEST-FIRST + строгие контракты)
    try {
      validateManifest(manifest);
    } catch (e) {
      console.error('Manifest validation failed:', e);
      dispatch({ type: 'BATCH_FAILED', payload: { error: 'Invalid manifest' } } as any);
      return;
    }

    // Переинициализация FSM под новый манифест
    const initial = createInitialBatchState(manifest.items.length, getChunksCount(manifest));
    dispatch({ type: 'RESET' } as any);

    try {
      validateFSMState(initial);
    } catch (e) {
      console.error('FSM initial validation failed:', e);
    }
    setBatchResult(null);
  }, [manifest]);

  // --- Очистка при размонтировании ---
  useEffect(() => {
    return () => {
      abortController.current?.abort();
      retryQueue.current.clear();
    };
  }, []);

  /**
   * Запуск обработки батча:
   * 1) submitBatch(manifest) с повторами
   * 2) pollForBatchResult(batchId)
   * 3) processBatchResult(manifest, result)
   * 4) finalize FSM
   */
  const startProcessing = useCallback(async () => {
    if (!manifest) throw new Error('Нет манифеста для обработки');

    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      dispatch({ type: 'SUBMIT_BATCH' } as any);

      const submitRes = await withRetry(
        () => apiClient.submitBatch(manifest),
        { maxAttempts: 3 },
        'submit-batch'
      );

      dispatch({ type: 'BATCH_STARTED' } as any);

      const data = await pollForBatchResult(submitRes.batchId, abortController.current.signal);

      await processBatchResult(manifest, data);

      dispatch({ type: 'BATCH_COMPLETED' } as any);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // отменено пользователем
      }
      dispatch({
        type: 'BATCH_FAILED',
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as any);
      throw error;
    }
  }, [manifest]);

  /**
   * Polling результатов батча c таймаутом / backoff-ожиданием.
   * Возвращает валидный `BatchResultV1`, когда готов.
   */
  const pollForBatchResult = useCallback(
    async (batchId: string, signal: AbortSignal): Promise<BatchResultV1> => {
      const maxAttempts = 60; // ~5 минут при 5с интервале
      const intervalMs = 5000;
      let attempt = 0;

      while (attempt < maxAttempts && !signal.aborted) {
        try {
          const result = await apiClient.getBatchResult(batchId);
          return result;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'BATCH_PROCESSING') {
            attempt++;
            await sleep(intervalMs);
            continue;
          }
          throw err;
        }
      }

      if (signal.aborted) {
        throw new Error('Batch processing was cancelled');
      }
      throw new Error('Batch processing timed out');
    },
    []
  );

  /**
   * Обработка итоговых (или частичных) результатов:
   * - агрегируем по SID
   * - отмечаем полученные/ошибочные SID в FSM
   * - собираем LV/RU тексты
   * - запускаем очередь ретраев при необходимости
   */
  const processBatchResult = useCallback(
    async (m: Manifest, batchData: BatchResultV1) => {
      const { data: aggregated, metrics } = aggregateResultsBySid(m, batchData);

      // Обновляем FSM по пришедшим элементам
      batchData.items.forEach((it) => {
        dispatch({ type: 'SID_RECEIVED', payload: { sid: it.sid } } as any);
      });

      // Ошибки (частичные результаты)
      batchData.errors?.forEach((e) => {
        dispatch({ type: 'SID_FAILED', payload: { sid: e.sid, error: e.error } } as any);
        const mi = m.items[e.sid];
        if (mi && (e.error || '').toUpperCase() !== 'PERMANENT_FAILURE') {
          retryQueue.current.enqueue(e.sid, mi.lv, new ApiError(e.error, e.errorCode || 'UNKNOWN'));
        }
      });

      // Сборка детерминированных текстов
      const lvText = buildLvTextFromManifest(m, true);
      const ruText = buildRussianTextFromAggregation(m, aggregated, true);
      const cards = extractAllFlashcards(aggregated);

      setBatchResult({ lvText, ruText, cards, metrics });

      // Если есть ошибки — прогоняем retry-очередь
      if (batchData.errors?.length) {
        await retryQueue.current.processQueue(
          m.batchId,
          (sid: number, _retryResult: unknown) => {
            dispatch({ type: 'SID_RECEIVED', payload: { sid } } as any);
            // TODO: по желанию — слить retry-результат в aggregated и обновить ruText/cards
          },
          (sid: number, error: Error) => {
            dispatch({ type: 'SID_FAILED', payload: { sid, error: error.message } } as any);
          }
        );
      }
    },
    []
  );

  /** Отмена текущей обработки */
  const cancelProcessing = useCallback(async () => {
    abortController.current?.abort();
    if (manifest) {
      try {
        await apiClient.cancelBatch(manifest.batchId);
      } catch (e) {
        console.warn('Cancel batch failed:', e);
      }
    }
    dispatch({ type: 'RESET' } as any);
    setBatchResult(null);
  }, [manifest]);

  /** Сброс состояния (для повторного запуска с тем же манифестом) */
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' } as any);
    setBatchResult(null);
    retryQueue.current.clear();
    abortController.current?.abort();
    abortController.current = null;
  }, []);

  // --- Вычисляемые значения для UI ---
  const progress = useMemo(() => FSMSelectors.getProgress(fsmState), [fsmState]); // 0..1
  const sidCounts = useMemo(() => FSMSelectors.getSidStateCounts(fsmState), [fsmState]);
  const processingTime = useMemo(
    () => FSMSelectors.getProcessingTime(fsmState) ?? 0,
    [fsmState]
  );

  const isProcessing =
    fsmState.batchState === 'in_progress' || fsmState.batchState === 'submitted';
  const canStart = !!manifest && (fsmState.batchState === 'idle' || fsmState.batchState === 'failed');
  const canCancel = fsmState.batchState === 'in_progress' || fsmState.batchState === 'submitted';

  return {
    // состояние
    fsmState: fsmState as BatchFSMState,
    batchResult,

    // селекторы
    progress,
    sidCounts,
    processingTime,

    // флаги
    isProcessing,
    canStart,
    canCancel,

    // действия
    startProcessing,
    cancelProcessing,
    reset,
  };
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getChunksCount(manifest: Manifest): number {
  // Кол-во чанков: max(chunkIndex) + 1
  const maxIdx = manifest.items.reduce((acc, it) => Math.max(acc, it.chunkIndex), -1);
  return maxIdx + 1;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
