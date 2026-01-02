# STATUS — flashcards-v3 (snapshot)

- S2 = 100% (updated 2025-12-29): hooks/FSM/aggregation/config/error‑UX/tests — готово; tool‑use
  интегрирован в ретраи (LLMAdapter/useLLMToolsEmitter + proxy), добавлен single‑flow (TextStub).
  Сегментация — переключаемая (primitive | latvian_sentence_tester:local). Включён провайдер:
  `/claude/provider/single` и `/claude/provider/batch*` на сервере + клиентские маршруты по флагу
  `llm.useProvider`. **Tool-builder реализован** (`src/utils/toolBuilder.ts`) — генератор Claude API
  tool definitions из Zod-схем (JSON Schema v7, 100% test coverage).
- Ближайшие шаги (S3 — обновлён 2025-12-29):
  1. Интеграция toolBuilder в LLMAdapter/BatchAdapter (использовать `buildEmitFlashcardsTool()`);
  2. E2E smoke test с реальным Claude API (проверка generated schema);
  3. Provider batch → Message Batches API full parity;
  4. Reading mode (tooltip perf, context menu, reveal-on-peek);
  5. Flashcards mode polish (navigation, flip animations, context expansion).

Чек‑лист

- ✅ FSM + селекторы/флаги — `src/utils/fsm.ts`
- ✅ Хуки `useBatch`/`useBatchPipeline` — `src/hooks/useBatch.ts`
- ✅ Агрегация по SID — `src/utils/aggregator.ts`
- ✅ Манифест/сигнатуры — `src/utils/manifest.ts`, `src/types/manifest.ts`
- ✅ Клиент/поллинг/Retry‑After — `src/api/client.ts`
- ✅ Конфиги (Zod) — `src/config/index.ts`, `config/*.json`
- ✅ Ошибки/i18n баннеры — `src/hooks/useErrorBanners.tsx`, `src/locales/{en,ru}.json`
- ✅ Тесты (FSM/Retry‑After/инварианты) — `src/__tests__/hooks/*`, `src/__tests__/property/*`,
  `src/__tests__/api/*`
- ⚠️ Сервер — mock batch‑proxy — `server/src/index.ts`
  - Server runtime: CommonJS (mock-proxy); ESM migration planned post-v1.0 (tech debt).
  - Mock behavior: deterministic failures sid % 4 === 1 to test banners/retry.
- ✅ Tool‑use adapters (LLMAdapter/BatchAdapter) — скелеты + интеграция (retry/single) через proxy
- ✅ Zod‑схема `emit_flashcards`
- ✅ Парсер JSON‑only `tool_use` (через LLMAdapter/useLLMToolsEmitter)
- ✅ RetryQueue — split‑retry/merge реализован
- ✅ Чанкование — из конфигов (batch.chunking)
- ✅ Сегментация — переключаемая, локальный модуль скопирован (см. `doc/configs/nlp.md`)
- ✅ Provider single/tool‑use — включаемо флагом `llm.useProvider`; mock single/batch сохранены.
- ✅ Provider batch submit/result/status — сервер реализует `/claude/provider/batch*`; клиент
  учитывает флаг.
- ✅ Tool-builder — `src/utils/toolBuilder.ts` (buildEmitFlashcardsTool, buildToolFromZodSchema;
  JSON Schema v7, 41 тест, 100% coverage).
- ❌ **CRITICAL: Соответствие Message Batches (официальный API)** — НЕ реализовано!
  - Текущая реализация: синхронный цикл по Messages API (без экономии, без JSONL).
  - Требуется: официальный Claude Message Batches API (50% экономия, async, JSONL).
  - План: S4 или отдельный спринт (см. TRS §7, `doc/best_practices/Message Batches.md`).
  - Ссылки: https://docs.anthropic.com/en/docs/build-with-claude/batch-processing

Ссылки

- План S2: `doc/plan/plan_1.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Политика tools: `doc/best_practices/tool-use.md`
- Network: apiBaseUrl=/api, llmRouteBase=/claude; requestTimeoutMs=15000ms; healthTimeoutMs=3000ms.
- Health endpoint: <apiBaseUrl>/health → backend /health (via Vite proxy).
