# Flashcards-v3 — AI Agent Guide (v5.1)

> Инструкция для ИИ-помощников (ChatGPT/Claude и др.), которые пишут/правят код и документацию в
> этом репозитории. Соблюдай архитектурные инварианты, ТЗ и планы. Любые правки должны ссылаться на
> конкретные пункты TRS/планов.

---

Статус: S2 — ядро готово; tool-use отсутствует (LLMAdapter/BatchAdapter, emit_flashcards schema).

## 0) Каноничные источники (читать по порядку)

1. **TRS:** `doc/trs/trs_v_5.md` — источник истины по функционалу/нефункционалке/приёмке.
2. **Roadmap:** `doc/roadmap/roadmap.md` — вехи, зависимости, KPI.
3. **Планы:** `doc/plan/plan_1.md … plan_5.md` — что входит в текущий этап.
4. **Best-Practices:** `doc/best_practices/*` — `TechnicalGuidesForClaudeAPIv2.0.md` (**приоритет**
   после официальных доков Anthropic), — `tool-use.md` (policy
   tools/JSON-only/caching/stop-reasons), — `Message Batches.md`, `MessageBatches2.md` (паритет с
   Messages API), — `best_practices0.md`, `best_practices1.md` (React/TS/Node 2025).
5. **README** — обзор, структура репозитория.

> В описании PR укажи ссылки на § TRS и соответствующий `plan_X.md`.

---

## 1) Архитектурные инварианты (НЕ нарушать)

- **Manifest-first:** порядок/состав LV-предложений задаёт Manifest (SID). LV собирается **только**
  из манифеста.
- **SID-aggregation:** результаты LLM/Batch сопоставляются по `custom_id==SID`; порядок строк JSONL
  **не значим**.
- **FSM-first:** UI — проекция конечного автомата (idle→submitted→in_progress→ready/failed).
- **JSON-only через tools:** все LLM-ответы — строго структурированный JSON через **Claude tools**
  (валидируем Zod). Гибриды с текстом запрещены.
- **Config-first:** никаких хардкодов (модель, лимиты, хоткеи, стили, задержки, языки). Всё из
  `config/*.json(.*)` со схемами Zod.
- **TS strict:** `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- **i18n/Theming:** все строки из `/src/locales/*`; темы — tokens/CSS vars.
- **Keys security:** секреты живут на прокси; фронт не хранит ключи.

---

## 2) Tool-use & Prompt-caching (policy)

- **JSON-only via tools:** все вызовы Claude проходят с `tools` + фиксированным `tool_choice`
  (эмиттер карточек/структуры). Парсим **первый** `tool_use` нужного имени → `input` → Zod.
- **Parallel tools:** по умолчанию **выключено**. Если включим — **все** `tool_result` возвращаются
  **одним** user-сообщением и **в начале** контента.
- **Stop reasons:** различаем `stop_reason` и HTTP-ошибки. Для `max_tokens` → **bump** лимита
  (single) или **split-retry** чанка (batch). Частичные результаты не блокируем.
- **Batch parity:** Message Batches поддерживает те же поля/фичи, что и Messages API (incl. tools).
- **Prompt caching:** стабилизируем `system` и определения `tools`; кеш — best-effort; смена
  `tool_choice` может инвалидировать кеш.

См. `doc/best_practices/tool-use.md` и `TechnicalGuidesForClaudeAPIv2.0.md`.

---

## 3) Техстек и режимы

- **Node.js** v24.6.0 (ESM), **npm** v11.5.1; Proxy: Express/Fastify (ESM).
- **Frontend:** React 18, TypeScript, Vite, Tailwind, Framer Motion, Cypress (E2E).
- **Режимы:** Text → Flashcards → Reading → Translation → Edit.
- **Сегментация:** `latvian_sentence_tester:local` (дефолт), 1 предложение/чанк (\~300 токенов) — из
  конфигов.

### Поток данных (критично)

```
Исходный текст → Сегментация → Manifest {sid, lv, sig} → LLM по чанкам (tools JSON-only)
                                       ↑
LV из Manifest ← Агрегация по SID ← Валидация DTO/Zod ← JSONL/tool_use input
RU/target по SID ← Каноникализация
```

---

## 4) Команды

- `npm run dev` (client+proxy), `npm run build`, `npm run start`
- `npm run lint -- --format codeframe`, `npm run test`, `npm run e2e`
- `npm run validate:config` (Zod/JSON Schema), `npm run docs:config`
- `npm run validate` (линт+тесты суммарно)

---

## 5) Batch & ошибки (UI-первая диагностика)

- Перед стартом single/batch и загрузкой `batch_id` делаем **pre-flight** `/api/health`; при down
  прокси/нет сети → **моментальный баннер**.
- Фронт polling статуса адаптивный (1–2s → 3–5s → 10–30s → 30–60s) с jitter; прокси уважает
  `Retry-After` при опросе Anthropic.
- Обрабатываем и показываем: `429`, `413`, `500`, `529`, `expired` (≥29 дней). Консоль — вторично.
- Док-приоритет: `TechnicalGuidesForClaudeAPIv2.0.md` > `Message Batches.md`/`MessageBatches2.md`.

---

## 6) Reading: подсказки/контекст-меню/reveal-on-peek

- **Tooltip perf:** `tooltip.showDelayMs` (0..3000+), `debounceMs`, `cancelOnLeave=true`,
  **single-flight** (до порога — не грузить подсказку).
- **Приоритет фраз** над словами; позиционирование внутри viewport; mobile — popover/bottom-sheet.
- **Context menu** (ПКМ/long-press): `config/actions.json`; плейсхолдеры `%w/%p/%b/%s/%sel/%lv/%tl`;
  белый список доменов; `_blank` + `noopener`.
- **Reveal-on-peek:** успешный показ подсказки делает карточку видимой, добавляет `peeked`-подсветку
  (стили из конфига). Правки в Edit имеют приоритет.

---

## 7) Flashcards/Translation/Edit (ключевые правила)

- **Flashcards:** ←/→ навигация; Space/↑/↓ flip; `h` hide; контексты: N по умолчанию, «показать
  больше» до M (из конфигов); flip-анимация/радиусы/шрифт (`Noto Sans Display`) — из конфигов; при
  переходе всегда показываем **front**.
- **Translation:** нижняя панель статистик — слова (UAX-29), символы (графемы), предложения (SID),
  фразы (unique|occurrences) — из конфигов.
- **Edit:** чекбокс **VISIBLE** + **Master Visible**; правка базового перевода и переводов
  контекстов с **моментальной** пропагацией; «править контексты (N)» открывает модал/таблицу;
  **Restore** (откат ко входному результату) + опц. **Undo**.

---

## 8) Import/Export

- **JSON:** полный снапшот состояния (включая правки/видимость/i18n/targetLanguage/policy). Экспорт
  → ре-импорт = **бит-в-бит** состояние.
- **JSONL (Anthropic Console):** потоковый парсер; `custom_id==SID`; порядок строк не важен; отчёт
  imported/skipped/invalid. Разрешён офлайн-импорт после 29 дней.
- **Merge-стратегии:** `replace-all | merge-keep-local | merge-prefer-imported` (дефолт — из
  конфига).

---

## 9) Конфиги и документация

- Все параметры — в `/config/*.json`; валидация Zod в `src/types/config/*` (см. TRS §16).
- **RU‑доки** по каждому конфигу: `doc/configs/*.md`
  (назначение/ключи/дефолты/примеры/зависимости/валидация/pitfalls/changelog/owner).
- Индекс конфигов: `doc/configs/CONFIG_INDEX.md` (таблица name|path|schema|updated|owner). (Если
  настроено — команда `npm run docs:config`).
- Проверки:
  - `npm run validate:config` — fail‑fast отчёт по всем конфига‑файлам;
  - `npm run lint:anti-hardcode` — запрет моделей/интервалов/кейкодов/лимитов в коде.

---

## 10) Стандарты кода и тестирование

- **TypeScript strict**; иммутабельность состояний; явные `assert/invariant` на инвариантах.
- **Zod** на всех границах: proxy↔client, LLM↔proxy (tools), import/export.
- **Линт-вывод:** `eslint-formatter-codeframe`.
- **Тесты:** unit + integration + **E2E (Cypress)**; добавляем **golden-тесты** (порядок
  предложений) и **property-based** (инварианты).
- **A11y:** семантика/ARIA, фокус-кольца, контраст в темах.

### Тестирование (обёртка App)

- При RTL-монтаже `<App />` оборачивайте в провайдеры как в `src/main.tsx`: `I18nProvider` →
  `ThemeProvider` → `ErrorBannersProvider`. Это предотвращает ошибки вида «ErrorBannersProvider
  missing» и воспроизводит окружение рантайма.

### Стиль кода (для ИИ-агентов)

- Функциональный стиль; без скрытых side-effects.
- Immutable-обновления; аккуратные редьюсеры/селекторы.
- Комментарии **на русском** для бизнес-логики; англ. — для техтерминов.
- Именование: Components — `PascalCase`; funcs/vars — `camelCase`; const — `SCREAMING_SNAKE_CASE`;
  Types — `PascalCase`.

---

## 11) Модули

- `src/types/*` — доменные типы/DTO.
- `src/utils/manifest.ts` — создание/валидация манифеста.
- `src/utils/aggregator.ts` — агрегация по SID/JSONL.
- `src/utils/fsm.ts` — FSM batch-процесса.
- `src/api/client.ts` — HTTP-клиент + Zod.
- `src/hooks/*` — бизнес-логика (tooltip controller, batch polling, visibility policy).
- `src/components/*` — UI (режимы, Import/Export, меню).
- Proxy: `/api/health`, `/api/llm/single`, `/api/batch/{create,status,result}`.

---

### Hooks contract (S2)

Публичный API пайплайна:

- `useBatch(manifest)`: отдаёт `fsmState`, `progress/sidCounts/processingTime`, флаги
  `isProcessing/canStart/canCancel`, действия `startProcessing/cancelProcessing/reset/pollOnce`,
  счётчики `submitAttempts/pollAttempts`.
- `useBatchPipeline(maxSentencesPerChunk)`: добавляет `submit(text)` и `cancel()`, а также флаги
  `isIdle/isBusy/isDone/isFailed` и `elapsedMs`.
- Политика баннеров: при неретраибельных ошибках хук вызывает `pushFromError` (немедленный показ).

Подробнее: `src/hooks/AGENT.md`.

---

## 12) Как ИИ-агент вносит изменения

1. Определи релиз/этап (см. `plan_X.md`). **Не** добавляй фичи будущих этапов без явного флага.
2. Сверь с TRS (разделы/Acceptance).
3. Проверь/дополни конфиги: при отсутствии ключей предложи схему Zod + RU-док.
4. Измени код **модульно** (адаптеры/сторы/компоненты). Избегай хардкодов.
5. Добавь/обнови тесты (unit/E2E), i18n-ключи.
6. Обнови доки.
7. В ответе/PR приложи **минимальные git-diff** в рамках объявленных путей; кратко: что/зачем/ссылки
   на § TRS/plan; **риски** и как проверять.

---

## 13) Чек-лист «не повторять ошибки»

- ☐ Нет race conditions (single-flight, FSM, селекторы).
- ☐ Источник порядка — **Manifest**, не UI/LLM.
- ☐ FSM переходы детерминированы; без циклов.
- ☐ DTO/версии схем валидируются; метрики: `schema_mismatch_count`, `order_violation_count`.
- ☐ Баннеры ошибок появляются **сразу**; консоль — вторично.
- ☐ Строки/стили/лимиты — из конфигов; i18n покрытие полное.

### Метрики мониторинга

`schema_mismatch_count`, `sig_mismatch_count`, `missing_target_count`, `order_violation_count`.

---

## 14) Мысленная модель и отладка

- **Манифест первый** → **SID ключ** → **FSM определяет UI** → **Инварианты = безопасность**.
- Debug: 1) состояние FSM; 2) валидность манифеста (SID/sig); 3) агрегация по SID; 4) Zod-схемы и
  версии; 5) stop-reasons vs HTTP-ошибки.

---

## 15) Быстрые ссылки

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Планы: `doc/plan/plan_1.md … plan_5.md`
- Best-Practices: `doc/best_practices/*` (incl. `tool-use.md`, `TechnicalGuidesForClaudeAPIv2.0.md`)
- README: `README.md`

> При расхождениях между кодом и документами — укажи это в PR и предложи правку TRS/планов.
