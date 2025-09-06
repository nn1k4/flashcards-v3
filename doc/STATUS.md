# STATUS — flashcards-v3 (snapshot)

- S2 ≈ 70–75%: hooks/FSM/aggregation/config/error‑UX/tests — готово; tool‑use отсутствует.
- Ближайшие шаги: (1) adapters, (2) Zod emit_flashcards, (3) интеграция с useBatch.

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
- ❌ Tool‑use adapters (LLMAdapter/BatchAdapter)
- ❌ Zod‑схема `emit_flashcards`
- ❌ Парсер JSON‑only `tool_use` (первый `emit_flashcards.input`)

Ссылки

- План S2: `doc/plan/plan_1.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Политика tools: `doc/best_practices/tool-use.md`
