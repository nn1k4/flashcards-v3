# STATUS — flashcards-v3 (snapshot)

**Updated:** 2026-01-03

---

## Current Sprint: S4 (Reading v1 + Message Batches API)

### S4-1: Message Batches API — DONE ✅

- ✅ Official Anthropic Message Batches API (`@anthropic-ai/sdk`)
- ✅ 50% cost savings via async batch processing
- ✅ Prompt caching with `cache_control: { type: 'ephemeral' }`
- ✅ Server: `server/src/services/messageBatches.ts`
- ✅ Routes: `/claude/batches/*` (create, get, list, cancel, delete)
- ✅ Client: `src/api/client.ts` (MessageBatch types + methods)
- ✅ Hook: `src/hooks/useMessageBatches.ts` (adaptive polling, flashcard extraction)
- ✅ Store: `src/stores/batchHistoryStore.ts` (Zustand + persist, last 10 batches)
- ✅ UI: Processing mode selector (Single / Mock Batch / Message Batches 50% off)
- ✅ UI: Current Batch panel, Batch History panel, Cancel functionality
- ✅ E2E tests: 16/16 passing (Playwright)

### S4-2: Reading v1 — TODO

- ❌ Подсветка слов/фраз (приоритет: фраза)
- ❌ Tooltip (delay/debounce/cancel/single-flight)
- ❌ Позиционирование в viewport
- ❌ Mobile popover/bottom-sheet

---

## Previous Sprints

- **S3** = 100% (2026-01-02): Flashcards v1 — Zustand store, useFlashcards/useHotkeys hooks,
  FlashcardsView UI с CSS 3D flip, интеграция с batch pipeline, E2E тесты.

- **S2** = 100% (2025-12-29): hooks/FSM/aggregation/config/error-UX/tests — готово; tool-use
  интегрирован в ретраи (LLMAdapter/useLLMToolsEmitter + proxy), добавлен single-flow (TextStub).
  Сегментация — переключаемая (primitive | latvian_sentence_tester:local). Включён провайдер:
  `/claude/provider/single` и `/claude/provider/batch*` на сервере + клиентские маршруты по флагу
  `llm.useProvider`. **Tool-builder реализован** (`src/utils/toolBuilder.ts`) — генератор Claude API
  tool definitions из Zod-схем (JSON Schema v7, 100% test coverage).

---

## Checklist

### Core Infrastructure

- ✅ FSM + селекторы/флаги — `src/utils/fsm.ts`
- ✅ Хуки `useBatch`/`useBatchPipeline` — `src/hooks/useBatch.ts`
- ✅ Агрегация по SID — `src/utils/aggregator.ts`
- ✅ Манифест/сигнатуры — `src/utils/manifest.ts`, `src/types/manifest.ts`
- ✅ Клиент/поллинг/Retry-After — `src/api/client.ts`
- ✅ Конфиги (Zod) — `src/config/index.ts`, `config/*.json`
- ✅ Ошибки/i18n баннеры — `src/hooks/useErrorBanners.tsx`, `src/locales/{en,ru}.json`
- ✅ Тесты (FSM/Retry-After/инварианты) — `src/__tests__/hooks/*`, `src/__tests__/property/*`,
  `src/__tests__/api/*`

### Tool-use & LLM

- ✅ Tool-use adapters (LLMAdapter/BatchAdapter) — скелеты + интеграция
- ✅ Zod-схема `emit_flashcards` — `src/types/tool_use.ts`
- ✅ Парсер JSON-only `tool_use` (через LLMAdapter/useLLMToolsEmitter)
- ✅ Tool-builder — `src/utils/toolBuilder.ts` (JSON Schema v7, 41 тест, 100% coverage)

### Message Batches API

- ✅ Official Anthropic SDK — `server/src/services/messageBatches.ts`
- ✅ Prompt caching — `cache_control: { type: 'ephemeral' }`
- ✅ Batch history store — `src/stores/batchHistoryStore.ts`
- ✅ useMessageBatches hook — `src/hooks/useMessageBatches.ts`
- ✅ UI mode selector — TextStub.tsx

### Flashcards (S3)

- ✅ Zustand store — `src/stores/flashcardsStore.ts`
- ✅ useFlashcards hook — `src/hooks/useFlashcards.ts`
- ✅ useHotkeys hook — `src/hooks/useHotkeys.ts`
- ✅ highlightForm utility — `src/utils/highlightForm.tsx`
- ✅ FlashcardsView UI — `src/components/Flashcards/*`
- ✅ CSS 3D flip animation
- ✅ E2E tests — `pw-e2e/flashcards.spec.ts`

### Server

- ✅ Mock batch-proxy — `server/src/index.ts`
- ✅ Message Batches service — `server/src/services/messageBatches.ts`
- ⚠️ Server runtime: CommonJS (ts-node); ESM migration planned post-v1.0

### Segmentation

- ✅ Сегментация — переключаемая, локальный модуль скопирован (см. `doc/configs/nlp.md`)

---

## Links

- Plan S4: `doc/plan/plan_1.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Best Practices: `doc/best_practices/*.md`
- Network config: `config/network.json` (apiBaseUrl=/api, llmRouteBase=/claude)
- Health endpoint: `/api/health`
