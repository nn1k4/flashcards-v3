# STATUS — flashcards-v3 (snapshot)

- S2 ≈ 50–55%: hooks/FSM/aggregation/config/error‑UX/tests — готово; tool‑use слой отсутствует
  (адаптеры/схемы/парсер). Сегментация — primitive (latvian_sentence_tester:local — в очереди).
- Ближайшие шаги (План доработок S2 — принят 2025-09-27):
  1. Zod‑схема `emit_flashcards` (tool_use.input) + строгий парсер первого `tool_use` нужного имени;
  2. Адаптеры `LLMAdapter` (single/tools JSON‑only) и `BatchAdapter` (Message Batches parity);
  3. Хук `useLLMToolsEmitter` (обёртка над LLMAdapter; stop reasons, в т.ч. `max_tokens`);
  4. Реализация `RetryQueue`: split‑retry проблемных SID + merge результатов;
  5. Чанкование из конфигов (вынести maxSentencesPerChunk из кода);
  6. Сегментация: задел `latvian_sentence_tester:local` (интерфейс/флаг), по умолчанию — primitive.

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
- ❌ Tool‑use adapters (LLMAdapter/BatchAdapter)
- ❌ Zod‑схема `emit_flashcards`
- ❌ Парсер JSON‑only `tool_use` (первый `emit_flashcards.input`)
- ⚠️ RetryQueue — заглушка (нет split‑retry/merge)
- ⚠️ Чанкование — задаётся аргументом hook; нужно вынести в конфиг
- ⚠️ Сегментация — сейчас `primitive`; `latvian_sentence_tester:local` — pending

Ссылки

- План S2: `doc/plan/plan_1.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Политика tools: `doc/best_practices/tool-use.md`
- Network: apiBaseUrl=/api, llmRouteBase=/claude; requestTimeoutMs=15000ms; healthTimeoutMs=3000ms.
- Health endpoint: <apiBaseUrl>/health → backend /health (via Vite proxy).
