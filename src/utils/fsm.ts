// src/utils/fsm.ts
// Машина состояний батч-процесса (FSM): единственный способ изменять состояние
import type { BatchState, SidState } from '../types/core';

// События FSM
export type FSMEvent =
  | { type: 'SUBMIT_BATCH' }
  | { type: 'BATCH_STARTED' }
  | { type: 'CHUNK_PROCESSED'; payload: { chunkIndex: number } }
  | { type: 'SID_RECEIVED'; payload: { sid: number } }
  | { type: 'SID_FAILED'; payload: { sid: number; error: string } }
  | { type: 'BATCH_COMPLETED' }
  | { type: 'BATCH_FAILED'; payload: { error: string } }
  | { type: 'RETRY_SID'; payload: { sid: number } }
  | { type: 'RESET' };

// Состояние FSM
export type BatchFSMState = {
  batchState: BatchState;
  perSid: Map<number, SidState>;
  errors: Array<{ sid: number; error: string; timestamp: string }>;
  processedChunks: Set<number>;
  totalChunks: number;
  totalSids: number;
  startTime?: string;
  endTime?: string;
};

/** Создание начального состояния FSM. Все SID — pending. */
export function createInitialBatchState(totalSids: number, totalChunks: number): BatchFSMState {
  const perSid = new Map<number, SidState>();
  for (let sid = 0; sid < totalSids; sid++) perSid.set(sid, 'pending');
  return {
    batchState: 'idle',
    perSid,
    errors: [],
    processedChunks: new Set(),
    totalChunks,
    totalSids,
  };
}

/**
 * Редьюсер FSM — все переходы детерминированы и проверяемы.
 * Комментарии на русском для бизнес-логики.
 */
export function batchFSMReducer(state: BatchFSMState, event: FSMEvent): BatchFSMState {
  const now = new Date().toISOString();

  switch (event.type) {
    case 'RESET':
      return createInitialBatchState(state.totalSids, state.totalChunks);

    case 'SUBMIT_BATCH': {
      if (state.batchState !== 'idle') {
        console.warn(`Invalid transition: SUBMIT_BATCH from ${state.batchState}`);
        return state;
      }
      return {
        ...state,
        batchState: 'submitted',
        errors: [],
        processedChunks: new Set(),
        startTime: now,
        // endTime: undefined, // ⛔ НЕ УКАЗЫВАЕМ ПРИ exactOptionalPropertyTypes
      };
    }

    case 'BATCH_STARTED': {
      if (state.batchState !== 'submitted') {
        console.warn(`Invalid transition: BATCH_STARTED from ${state.batchState}`);
        return state;
      }
      return { ...state, batchState: 'in_progress' };
    }

    case 'CHUNK_PROCESSED': {
      if (state.batchState !== 'in_progress') {
        console.warn(`Invalid transition: CHUNK_PROCESSED from ${state.batchState}`);
        return state;
      }
      const processed = new Set(state.processedChunks);
      processed.add(event.payload.chunkIndex);
      // Если все чанки обработаны — можем перейти в partial_ready
      const allChunks = processed.size === state.totalChunks;
      return {
        ...state,
        processedChunks: processed,
        batchState: allChunks ? 'partial_ready' : state.batchState,
      };
    }

    case 'SID_RECEIVED': {
      const perSid = new Map(state.perSid);
      perSid.set(event.payload.sid, 'received');
      return { ...state, perSid };
    }

    case 'RETRY_SID': {
      const perSid = new Map(state.perSid);
      perSid.set(event.payload.sid, 'retrying');
      return { ...state, perSid };
    }

    case 'SID_FAILED': {
      const perSid = new Map(state.perSid);
      perSid.set(event.payload.sid, 'invalid');
      return {
        ...state,
        perSid,
        errors: [
          ...state.errors,
          { sid: event.payload.sid, error: event.payload.error, timestamp: now },
        ],
      };
    }

    case 'BATCH_COMPLETED': {
      // Готово: фиксируем время и состояние
      return { ...state, batchState: 'ready', endTime: now };
    }

    case 'BATCH_FAILED': {
      return {
        ...state,
        batchState: 'failed',
        endTime: now,
        errors: [{ sid: -1, error: event.payload.error, timestamp: now }, ...state.errors],
      };
    }

    default:
      return state;
  }
}

/** Селекторы для UI/логики. */
export const FSMSelectors = {
  /** Прогресс по полученным SID (0..1). */
  getProgress: (state: BatchFSMState): number => {
    const counts = FSMSelectors.getSidStateCounts(state);
    return state.totalSids > 0 ? counts.received / state.totalSids : 0;
  },

  /** Распределение состояний SID. */
  getSidStateCounts: (
    state: BatchFSMState,
  ): {
    pending: number;
    received: number;
    invalid: number;
    retrying: number;
    skipped: number;
  } => {
    const counts = { pending: 0, received: 0, invalid: 0, retrying: 0, skipped: 0 };
    state.perSid.forEach((s) => {
      if (s in counts) (counts as any)[s]++; // s ∈ {'pending','received','invalid','retrying','skipped'}
    });
    return counts;
  },

  /** Время обработки в мс (если старт известен). */
  getProcessingTime: (state: BatchFSMState): number | null => {
    if (!state.startTime) return null;
    const end = state.endTime || new Date().toISOString();
    return new Date(end).getTime() - new Date(state.startTime).getTime();
  },

  /** Готов ли батч к завершению (нет pending/retrying). */
  isReadyToComplete: (state: BatchFSMState): boolean => {
    const c = FSMSelectors.getSidStateCounts(state);
    return c.pending === 0 && c.retrying === 0;
  },

  /** Есть ли критические ошибки (sid = -1). */
  hasCriticalErrors: (state: BatchFSMState): boolean => {
    return state.errors.some((e) => e.sid === -1);
  },
};

/** Валидация корректности состояния FSM для тестов/диагностики. */
export function validateFSMState(state: BatchFSMState): void {
  // Проверка множества SID
  const expected = Array.from({ length: state.totalSids }, (_, i) => i);
  const actual = Array.from(state.perSid.keys()).sort((a, b) => a - b);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error('FSM state validation failed: SID mismatch');
  }

  // ready недопустим при неоконченных SID
  if (state.batchState === 'ready' && !FSMSelectors.isReadyToComplete(state)) {
    throw new Error('FSM state validation failed: marked as ready but has pending SIDs');
  }

  // processedChunks не может превышать totalChunks
  if (state.processedChunks.size > state.totalChunks) {
    throw new Error('FSM state validation failed: more chunks processed than total');
  }
}
