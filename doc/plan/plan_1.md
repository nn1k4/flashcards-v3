# План реализации — Этап 1 (MVP v1)

Связка с ТЗ: **TRS v5.1** (§1–§8, §9, §10, §11, §12, §14–§18, §20 — «MVP (v1)»). Приоритет доков:
оф. Anthropic → `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` → `Message Batches.md` /
`MessageBatches2.md` → `tool-use.md`.

---

## 0) Принципы и границы MVP

- Пользовательские режимы: **Text → Flashcards → Reading → Translation → Edit**.
- Поддержка **одиночной** обработки и **переключаемого batch-режима** (без JSONL-импорта; импорт в
  v1.1).
- **Tool-use JSON-only**: все LLM-вызовы идут через **единственный emitter-tool** с `tool_choice`;
  парсинг из `tool_use.input` + **Zod**.
- **Prompt caching hygiene**: стабилизированы `system` и `tools` (кэшируемые), изменяем в основном
  `messages.user`.
- **Stop reasons**: минимум — детект `max_tokens` + **bump/split-retry** логика (UI-улучшения и
  телеметрия — в v1.1).
- **Config-first**: все параметры из `/config` (Zod-валидация), **никаких хардкодов** (анти-линт).
- Ошибки и статусы — **баннеры в UI** + адаптивный polling + уважение `Retry-After`.
- Тесты: **unit + integration + E2E (Cypress)**. Линт: **eslint-formatter-codeframe**.

Не входят в MVP (перенесено в следующие этапы): контекстное меню ПКМ, Restore/Undo, JSONL-импорт,
OCR/PDF/Subtitles, Media follow-highlight, профили/подписки.

---

## 1) Треки работ и задачи

### 1.1 Инфраструктура и конфиги

- [ ] Структура `/config/*.json` + Zod-схемы: `app`, `i18n`, `theme`, `network`, `llm`, `batch`,
      `flashcards`, `reading`, `translation`, `edit`, `io`.
- [ ] Валидатор конфигов при старте; команда `npm run validate:config`.
- [ ] Скрипт «анти-хардкод» (`lint:anti-hardcode`) + ESLint c `eslint-formatter-codeframe`.
- [ ] RU-документация `/doc/configs/*` (назначение ключей, дефолты, примеры, зависимости).

### 1.2 Backend-proxy (ESM, Node 24)

- [ ] `/api/health` (готовность/версии/проверка внешней сети; таймаут из конфига).
- [ ] Обёртки Anthropic: `/api/batch/{create,status,result}`, `/api/llm/single`.
- [ ] Политики таймаутов/ретраев/заголовков rate-limit (уважать `Retry-After`).
- [ ] Единый формат ошибок: 429/413/500/529 + советы для UI; нормализация сетевых/прокси ошибок.

### 1.3 Pipeline и модель данных (Manifest/SID + Tool-use)

- [ ] **Segmentation**: `latvian_sentence_tester:local`; дефолт **1 предложение/чанк**, лимит \~300
      токенов — из конфига.
- [ ] **Manifest**: `{ sid, lv, sig }` из спанов (SID = hash(docId\:start\:end)).
- [ ] **Tool-use builder**: стабильные `system` + `tools` + `tool_choice` (emitter); `cache_control`
      для кэшируемых блоков.
- [ ] **Parser**: извлечение первого `tool_use` нужного имени, парсинг `tool_use.input`,
      Zod-валидация.
- [ ] **Stop reasons**: обработка `max_tokens` — single: bump; batch: split-retry только проблемных
      чанков (частичные успехи не теряются).
- [ ] **Adapters**: `LLMAdapter` (single), `BatchAdapter` (create/status/result); агрегация по
      **SID** (JSONL-порядок игнорируется).

### 1.4 UI: Text

- [ ] Поле ввода (лимит из конфига), кнопка **Очистить**.
- [ ] Переключатель **Использовать пакетную обработку** — меняет текст кнопки на «Начать пакетную
      обработку».
- [ ] При включённой галочке — форма «Получить результаты batch»: `batch_id`, Загрузить, история с
      пометкой **просрочено** (≥29 дней).
- [ ] **Pre-flight** `/api/health` перед любым стартом/загрузкой.

### 1.5 UI: Flashcards

- [ ] Карточки: front/back; контексты (N по умолчанию, «показать больше» до M — из конфигов).
- [ ] Хоткеи: ←/→ (навигация), Space/↑/↓ (flip), `h` (скрыть).
- [ ] Подсветка целевой формы в контекстах; при навигации всегда начинать с **front**.
- [ ] Стили/шрифт/анимация flip — из конфигов (по умолчанию `Noto Sans Display`).
- [ ] Политика видимости: `all-visible` (дефолт).

### 1.6 UI: Reading

- [ ] Подсветка слов (A) и фраз (B) с легендой; при пересечении — приоритет **фразы**.
- [ ] Tooltip: surface-форма, позиционирование внутри viewport; мобильный popover/bottom-sheet.
- [ ] Производительность: `tooltip.showDelayMs` (дефолт 0), `debounceMs`, `cancelOnLeave`,
      **single-flight** запросов.

### 1.7 UI: Translation

- [ ] Панель перевода; статистика: слова (UAX-29), символы (графемы), предложения (по SID), фразы
      (unique|occurrences).

### 1.8 UI: Edit

- [ ] Таблица карточек: пагинация (`pageSize`), поиск по базовой форме/переводу (опц.: по
      контекстам).
- [ ] Чекбокс **VISIBLE** + **Master Visible** (для всех/фильтра).
- [ ] Редактирование **базового перевода** и **переводов контекстов**; моментальная пропагация в
      Flashcards/Reading/Translation.
- [ ] Ссылка «править контексты (N)» (модал/таблица). **Clear** — только в хедере.

### 1.9 Import/Export JSON

- [ ] Экспорт полного состояния (с правками) + метаданные
      `appVersion/schemaVersion/exportedAt/locale/targetLanguage`.
- [ ] Импорт: превью изменений, стратегии `replace-all | merge-keep-local | merge-prefer-imported`
      (дефолт — из конфига).
- [ ] Отчёты о конфликте/ошибках (локализованные баннеры).

### 1.10 i18n/Themes

- [ ] `/src/locales/{ru,uk,en}.json` (минимум ru/en в MVP), переключение языка.
- [ ] Тема: light/dark/system; уважение `prefers-color-scheme`.

### 1.11 Ошибки/баннеры/статусы

- [ ] Баннеры при: прокси down, нет сети, 429/413/500/529, **expired batch**, превышение размеров.
- [ ] Адаптивный polling фронта (1–2с → 3–5с → 10–30с → 30–60с) + jitter; respect `Retry-After`.

### 1.12 Тестирование/качество

- [ ] Unit: подсчёт статистик, tooltip-контроллер (delay/debounce/cancel/single-flight), reducers
      Stores, парсер JSONL и merge, анти-хардкод, нормализация ошибок.
- [ ] Integration: batch create/status/result; pre-flight и баннеры; пропагация
      Edit→Flashcards/Reading/Translation; tool-use парсинг (`tool_use.input`).
- [ ] E2E (Cypress): happy-path всех режимов; ошибки сети/прокси; batch-история; импорт/экспорт;
      базовый UX `max_tokens` (без отдельных диалогов).
- [ ] CI-скрипты: `lint`, `test`, `build`, `validate:config`.

---

## 2) Скелет спринтов (последовательность работ)

### S0 — Подготовка

- Конфиги + Zod; анти-хардкод; ESLint codeframe; базовая i18n/theming; заготовки Stores;
  документация конфигов (RU).

### S1 — Proxy & Health & Ошибки

- ESM-прокси, `/api/health`, единый формат ошибок, баннеры, адаптивный polling, уважение
  `Retry-After`.

### S2 — Pipeline Core (Manifest/SID + Tool-use)

- `latvian_sentence_tester:local` сегментация; Manifest.
- **Tool-use builder** (stable `system/tools/tool_choice` + cache_control), **Parser**
  (`tool_use.input` + Zod), агрегация по SID.
- LLMAdapter (single), BatchAdapter (create/status/result).

### S3 — Flashcards v1

- Отрисовка карточек; контексты N/M; хоткеи; `h` hide; стили/flip (из конфигов); сброс flip при
  навигации.

### S4 — Reading v1

- Подсветка слов/фраз (приоритет фразы), tooltip (delay/debounce/cancel/single-flight),
  позиционирование в viewport.

### S5 — Translation v1

- Текст + статистики (UAX-29/графемы/SID/фразы).

### S6 — Edit v1

- Таблица, поиск, VISIBLE + Master Visible, правка базового/контекстов с live-пропагацией, «править
  контексты (N)», Clear в хедере.

### S7 — Import/Export JSON

- Экспорт/импорт, превью/стратегии merge, отчёты об ошибках.

### S8 — Stop-reasons (минимум для MVP)

- Детект `max_tokens`; **bump** (single) / **split-retry** (batch) в хук; частичные успехи не
  блокируются. (Расширенный UX и телеметрия — в v1.1)

### S9 — QA-пак

- Unit + Integration + E2E; перф-пасс (виртуализация списков при необходимости); шлифовка
  баннеров/текстов; финальная валидация конфигов.

---

## 3) Definition of Done (DoD)

- **Config-first**: все параметры читаются из `/config`; Zod-валидация зелёная; анти-хардкод линт —
  без нарушений.
- **Tool-use JSON-only**: emitter-tool с `tool_choice`; парсинг `tool_use.input` + Zod; стабильные
  `system/tools` для кеша.
- **Batch parity**: те же фичи, что в Messages API; агрегация по **SID**; JSONL-порядок
  игнорируется.
- **Stop reasons**: логика bump/split-retry реализована (без сложного UI).
- **Ошибки/баннеры**: моментально видимые для прокси/сети/429/413/500/529/expired; polling уважает
  `Retry-After`.
- **Режимы**: Flashcards/Reading/Translation/Edit соответствуют Acceptance из ТЗ; хоткеи; контексты
  N/M; tooltip-производительность.
- **Import/Export JSON**: ре-импорт экспортированного снапшота восстанавливает **идентичное
  состояние**.
- **Тесты**: unit критичных функций, integration (batch/health/propagation/tool-use), E2E
  happy-path + ошибки сети/прокси.
- **Документация**: обновлены README, AGENT/Codex, краткие RU-доки по конфигам.

---

## 4) Риски и смягчение

- **Стабильность batches**: строго следовать `TechnicalGuidesForClaudeAPIv2.0.md`; backoff +
  уважение `Retry-After`; сплит-ретраи.
- **Производительность Reading**: задержка tooltip, debounce, single-flight; ограничение
  параллелизма.
- **Кэш промптов**: не менять часто `system/tools`; помнить, что смена `tool_choice` инвалидирует
  кеш; версионировать emitter-schema.
- **Согласованность Stores**: централизованные события, мемо-селекторы; тесты на порядок SID.
- **i18n расширение**: ранняя декомпозиция ключей; миграции словарей (скрипты).

---

## 5) Артефакты

- Диаграмма модулей (Mermaid) в `doc/architecture.mmd` (обновить после S2).
- Шаблон PR-чеклиста (DoD + ссылки на пункты ТЗ).
- Примеры запросов с `tools/tool_choice` и разбором `tool_use.input` (мини-гайд в
  `doc/best_practices/tool-use.md` — ссылка из README/AGENT/Codex).
