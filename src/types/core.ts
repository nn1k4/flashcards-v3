// src/types/core.ts
// Базовые примитивы системы (см. Этап 4.1 плана)
export type SentenceId = number;
export type ChunkIndex = number;
export type BatchId = string;
export type Signature = string;

// Состояния приложения
export type AppViewState = 'input' | 'processing' | 'ready';
export type ViewMode = 'reading' | 'translation' | 'flashcards';

// Состояния батч-процесса (FSM верхнего уровня)
export type BatchState = 'idle' | 'submitted' | 'in_progress' | 'ready' | 'failed';

// Состояния отдельных предложений
export type SidState = 'pending' | 'received' | 'invalid' | 'retrying' | 'skipped';

// Метрики обработки (для мониторинга инвариантов/качества)
export type ProcessingMetrics = {
  totalSids: number;
  receivedSids: number;
  missingSids: number;
  invalidSigs: number;
  duplicateRussian: number;
  emptyRussian: number;
  schemaViolations: number;
};
