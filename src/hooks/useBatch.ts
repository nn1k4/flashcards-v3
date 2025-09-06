// src/hooks/useBatch.ts
// Главный бизнес-хук: оркестрация батч-обработки
// Задачи: submit → polling → aggregate → FSM → retry → finalize
// Принципы: MANIFEST-FIRST, агрегация по SID, строгие контракты, явная FSM

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

// API-клиент и ошибки
import { apiClient, ApiError, isRetryableError } from '../api/client';
import { config as appConfig } from '../config';

// FSM: редьюсер состояния батча и селекторы
import {
  batchFSMReducer,
  createInitialBatchState,
  FSMFlags,
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
import { buildManifest } from '../utils/manifest';
import { RetryQueue } from '../utils/retry';
import { useErrorBanners } from './useErrorBanners';

// Контракты типов
import type { ProcessingMetrics } from '../types/core';
import type { BatchResultV1, Flashcard } from '../types/dto';
import type { Manifest } from '../types/manifest';

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

  // S2 additions
  pollOnce: () => Promise<boolean>;
  submitAttempts: number;
  pollAttempts: number;
};

// -----------------------------
// Константы backoff/polling
// -----------------------------
const SUBMIT_MAX_ATTEMPTS = 3;

const POLL_MAX_ATTEMPTS = 10000; // effectively bounded by schedule/elapsed

// -----------------------------
// Вспомогательные утилиты
// -----------------------------
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export function pickAdaptiveDelay(elapsedMs: number): number {
  const stages = appConfig.batch.polling.stages;
  // pick the last stage whose fromSec <= elapsed
  const elapsedSec = Math.floor(elapsedMs / 1000);
  let stage = stages[0]!;
  for (const s of stages) if (elapsedSec >= s.fromSec) stage = s;
  const { minMs, maxMs } = stage;
  const span = Math.max(0, maxMs - minMs);
  const jitter = Math.random() * span;
  return Math.max(100, minMs + jitter);
}

function shouldContinuePolling(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.code === 'BATCH_PROCESSING' ||
    err.code === 'RATE_LIMIT' ||
    err.code === 'TIMEOUT' ||
    err.code === 'NETWORK_ERROR' ||
    (err.status !== undefined && err.status >= 500) ||
    isRetryableError(err)
  );
}

// -----------------------------
// Основной хук
// -----------------------------
export function useBatch(manifest: Manifest | null): UseBatchReturn {
  const { pushFromError } = useErrorBanners();
  // --- FSM состояние батча ---
  const [fsmState, dispatch] = useReducer(
    batchFSMReducer,
    createInitialBatchState(manifest?.items.length || 0, manifest ? getChunksCount(manifest) : 0),
  );

  // --- Актуальный результат для отображения ---
  const [batchResult, setBatchResult] = useState<BatchResultView | null>(null);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [pollAttempts, setPollAttempts] = useState(0);

  // --- Очередь ретраев и контроллер отмены ---
  const retryQueue = useRef(new RetryQueue());
  const abortController = useRef<AbortController | null>(null);

  // --- Инициализация FSM при смене манифеста ---
  useEffect(() => {
    if (!manifest) return;

    try {
      validateManifest(manifest); // MANIFEST-FIRST + строгие контракты
    } catch (e) {
      console.error('Manifest validation failed:', e);
      dispatch({ type: 'BATCH_FAILED', payload: { error: 'Invalid manifest' } } as any);
      return;
    }

    // Переинициализация FSM под новый манифест
    dispatch({
      type: 'RESET',
    } as any);

    setBatchResult(null);
    retryQueue.current.clear();
    setSubmitAttempts(0);
    setPollAttempts(0);

    // Диагностика инвариантов «на холодную»
    try {
      validateFSMState(createInitialBatchState(manifest.items.length, getChunksCount(manifest)));
    } catch (e) {
      console.warn('FSM initial validation failed:', e);
    }
  }, [manifest]);

  // --- Очистка при размонтировании ---
  useEffect(() => {
    const ac = abortController.current;
    const rq = retryQueue.current;
    return () => {
      ac?.abort();
      rq?.clear();
    };
  }, []);

  // -----------------------------
  // Шаги процесса
  // -----------------------------
  const doSubmitWithRetry = useCallback(
    async (m: Manifest, signal: AbortSignal): Promise<{ batchId: string }> => {
      let attempt = 0;
      const start = Date.now();
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        attempt++;
        setSubmitAttempts(attempt);
        try {
          return await apiClient.submitBatch(m);
        } catch (e) {
          if (attempt >= SUBMIT_MAX_ATTEMPTS || !isRetryableError(e)) throw e;
          await sleep(pickAdaptiveDelay(Date.now() - start), signal);
        }
      }
    },
    [],
  );

  const pollUntilReady = useCallback(
    async (batchId: string, signal: AbortSignal): Promise<BatchResultV1> => {
      let attempt = 0;
      const start = Date.now();

      for (; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        try {
          // если готово — вернётся без ошибок
          const data = await apiClient.getBatchResult(batchId);
          return data;
        } catch (e) {
          if (shouldContinuePolling(e)) {
            // Honor Retry-After if provided and allowed by config
            let delayMs = pickAdaptiveDelay(Date.now() - start);
            if (
              appConfig.batch.polling.respectRetryAfter &&
              e instanceof ApiError &&
              typeof e.retryAfterMs === 'number' &&
              e.retryAfterMs >= 0
            ) {
              delayMs = Math.max(100, e.retryAfterMs);
            }
            setPollAttempts((n) => n + 1);
            await sleep(delayMs, signal);
            continue;
          }
          throw e; // фатальная ошибка
        }
      }
      throw new ApiError('Polling timeout exceeded', 'POLL_TIMEOUT', true);
    },
    [],
  );

  const processBatchResult = useCallback(async (m: Manifest, batchData: BatchResultV1) => {
    const { data: aggregated, metrics } = aggregateResultsBySid(m, batchData);

    // Отметим полученные / ошибочные SID в FSM
    if (batchData.items?.length) {
      for (const it of batchData.items) {
        dispatch({ type: 'SID_RECEIVED', payload: { sid: it.sid } } as any);
      }
    }
    if (batchData.errors?.length) {
      for (const er of batchData.errors) {
        dispatch({ type: 'SID_FAILED', payload: { sid: er.sid, error: er.error } } as any);

        const mi = m.items[er.sid];
        if (mi && (er.error || '').toUpperCase() !== 'PERMANENT_FAILURE') {
          retryQueue.current.enqueue(
            er.sid,
            mi.lv,
            new ApiError(er.error, er.errorCode || 'UNKNOWN'),
          );
        }
      }
    }

    // Сборка RU/LV и карточек строго по манифесту
    const lvText = buildLvTextFromManifest(m, true);
    const ruText = buildRussianTextFromAggregation(m, aggregated, true);
    const cards = extractAllFlashcards(aggregated);

    setBatchResult({ lvText, ruText, cards, metrics });

    // Если есть ошибки — обработать retry-очередь (best-effort, можно вынести в отдельный шаг)
    if (batchData.errors?.length) {
      await retryQueue.current.processQueue(
        m.batchId,
        (sid: number, _retryResult: unknown) => {
          // В этой версии только отмечаем получение; слияние retry-данных можно добавить позже
          dispatch({ type: 'SID_RECEIVED', payload: { sid } } as any);
        },
        (sid: number, error: Error) => {
          dispatch({ type: 'SID_FAILED', payload: { sid, error: error.message } } as any);
        },
      );
    }
  }, []);

  // -----------------------------
  // Публичные действия
  // -----------------------------
  const startProcessing = useCallback(async () => {
    if (!manifest) throw new Error('Нет манифеста для обработки');

    // Новый контроллер, старый — отменяем
    abortController.current?.abort();
    abortController.current = new AbortController();

    try {
      // Pre-flight health (TRS §8)
      await apiClient.getHealth();
      // INIT (извне редьюсера уже инициализировали, но для наглядности статус)
      dispatch({ type: 'SUBMIT_BATCH' } as any);

      // 1) submit с повторами
      const { batchId } = await doSubmitWithRetry(manifest, abortController.current.signal);
      dispatch({ type: 'BATCH_STARTED' } as any);

      // 2) polling с backoff+jitter и ретраибельностью
      const data = await pollUntilReady(batchId, abortController.current.signal);

      // 3) агрегация по SID + метрики + отметки FSM
      await processBatchResult(manifest, data);

      // 4) финализация
      dispatch({ type: 'BATCH_COMPLETED' } as any);

      // Диагностика инвариантов — не блокирующая (после макротика)
      setTimeout(() => {
        try {
          validateFSMState(fsmState);
        } catch (e) {
          console.warn('FSM validation warning after complete:', e);
        }
      }, 0);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return; // отменено пользователем
      dispatch({
        type: 'BATCH_FAILED',
        payload: { error: error instanceof Error ? error.message : String(error) },
      } as any);
      // S2: Error UX — немедленный баннер
      try {
        pushFromError(error);
      } catch (_e) {
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        /* ignore */
      }
      throw error;
    }
  }, [manifest, doSubmitWithRetry, pollUntilReady, processBatchResult, fsmState, pushFromError]);

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
    retryQueue.current.clear();
    setSubmitAttempts(0);
    setPollAttempts(0);
  }, [manifest]);

  const reset = useCallback(() => {
    abortController.current?.abort();
    dispatch({ type: 'RESET' } as any);
    setBatchResult(null);
    retryQueue.current.clear();
    abortController.current = null;
    setSubmitAttempts(0);
    setPollAttempts(0);
  }, []);

  // S2: explicit single poll attempt (no scheduling), returns true if ready
  const pollOnce = useCallback(async (): Promise<boolean> => {
    if (!manifest) throw new Error('Нет манифеста для обработки');
    try {
      const data = await apiClient.getBatchResult(manifest.batchId);
      await processBatchResult(manifest, data);
      dispatch({ type: 'BATCH_COMPLETED' } as any);
      return true;
    } catch (e) {
      if (shouldContinuePolling(e)) {
        setPollAttempts((n) => n + 1);
        return false;
      }
      dispatch({ type: 'BATCH_FAILED', payload: { error: (e as any)?.message ?? 'error' } } as any);
      try {
        pushFromError(e);
      } catch (_e2) {
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        /* ignore */
      }
      throw e;
    }
  }, [manifest, processBatchResult, pushFromError]);

  // --- Вычисляемые значения для UI ---
  const progress = useMemo(() => FSMSelectors.getProgress(fsmState), [fsmState]);
  const sidCounts = useMemo(() => FSMSelectors.getSidStateCounts(fsmState), [fsmState]);
  const processingTime = useMemo(() => FSMSelectors.getProcessingTime(fsmState) ?? 0, [fsmState]);

  const isProcessing = fsmState.batchState === 'in_progress' || fsmState.batchState === 'submitted';
  const canStart =
    !!manifest && (fsmState.batchState === 'idle' || fsmState.batchState === 'failed');
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
    pollOnce,
    submitAttempts,
    pollAttempts,
  };
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function getChunksCount(manifest: Manifest): number {
  // Кол-во чанков: max(chunkIndex) + 1
  const maxIdx = manifest.items.reduce((acc, it) => Math.max(acc, it.chunkIndex), -1);
  return maxIdx + 1;
}

// -----------------------------
// S2: Wrapper hook for Text → submit(text) → poll pipeline
// -----------------------------
export function useBatchPipeline(maxSentencesPerChunk: number = 20) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const inner = useBatch(manifest);
  const startedFor = useRef<string | null>(null);
  const { cancelProcessing: innerCancel, startProcessing: innerStart, fsmState } = inner;

  const submit = useCallback(
    async (text: string) => {
      const t = text?.trim() ?? '';
      if (!t) throw new Error('Пустой текст');
      const m = buildManifest(t, Math.max(1, Math.floor(maxSentencesPerChunk) || 1));
      startedFor.current = null; // reset auto-start guard
      setManifest(m);
    },
    [maxSentencesPerChunk],
  );

  const cancel = useCallback(async () => {
    await innerCancel();
  }, [innerCancel]);

  // Auto-start when a new manifest is set and FSM is idle
  useEffect(() => {
    if (!manifest) return;
    if (fsmState.batchState !== 'idle') return;
    if (startedFor.current === manifest.batchId) return;
    startedFor.current = manifest.batchId;
    // fire and forget; errors will be pushed via banners inside the hook
    innerStart().catch((_e) => {
      /* ignore */
    });
  }, [manifest, fsmState.batchState, innerStart]);

  return {
    ...inner,
    submit,
    cancel,
    isIdle: FSMFlags.isIdle(inner.fsmState),
    isBusy: FSMFlags.isBusy(inner.fsmState),
    isDone: FSMFlags.isDone(inner.fsmState),
    isFailed: FSMFlags.isFailed(inner.fsmState),
    elapsedMs: FSMSelectors.getProcessingTime(inner.fsmState) ?? 0,
  };
}
