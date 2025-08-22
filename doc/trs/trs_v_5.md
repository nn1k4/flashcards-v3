# Техническое задание (TRS) — Latvian Language Learning (flashcards-v3)

**Версия:** 5.1 **Дата:** {{today}} **Репо:**
[https://github.com/nn1k4/flashcards-v3](https://github.com/nn1k4/flashcards-v3) **Ядро
архитектуры:** SPA (React + TypeScript, Tailwind), Node.js proxy (ESM), **config-first**, адаптерная
система LLM/MT/OCR/медиа, **manifest-first**. **Целевая платформа:** desktop и mobile web
(mobile-first), задел на iOS/Android.

---

## 1. Обзор

### 1.1 Цели

- Изучение латышского через персональные карточки, режимы чтения и перевода.
- Стабильная **пакетная обработка** длинных текстов (Claude **Message Batches**) с прозрачным UI
  статуса и офлайн-просмотром результатов.
- **JSON-only** вывод из LLM через **Claude tools** (жёсткая схема + Zod), с учётом **prompt
  caching** и **stop reasons**.
- Максимальная конфигурируемость (модели, лимиты, хоткеи, i18n, темы), **без хардкодов**.
- Готовность к расширениям: PDF/OCR, субтитры/медиа-синхронизация, локальные NLP/MT,
  профили/подписки, TTS/изображения.

### 1.2 Область

- Веб-приложение с режимами **Text → Flashcards → Reading → Translation → Edit**.
- Node-proxy для LLM и batch API; локальная интеграция морфологии/сегментации.
- Импорт/экспорт/восстановление данных.
- i18n UI и целевого языка перевода; light/dark/system темы.

---

## 2. Архитектура и стек

- **Frontend:** React 18 + TypeScript, Vite, Tailwind; Framer Motion (микро-анимации); ESLint +
  Prettier/Biome.
- **Backend-proxy:** Node **v24.6.0**, npm **v11.5.1**, ESM; Express/Fastify; `dotenv`.
- **Стандарты кодовой базы:**
  - Конфиги (JSON/TS + Zod) — **единственный источник значений**. Магические числа запрещены.
  - Линт-вывод **eslint-formatter-codeframe** (`npm run lint -- --format codeframe`).
  - Тесты: unit + integration + **E2E (Cypress)**; golden/property-based для инвариантов.

- **Сегментация:** `latvian_sentence_tester` как **:local** модуль (V1), HTTP-fallback.
- **LLM адаптеры:** базовый — Anthropic (Claude); задел на OpenAI и др. через интерфейсы.
- **Хранилище:** in-memory + экспорт/импорт; серверная синхронизация — на этапе профилей.
- **Темизация:** Tailwind tokens + CSS vars; dark/light/system.

---

## 3. Конфиг-политика (обязательная)

- RU-доки для каждого конфига в `/doc/configs/*.md` (назначение, ключи, дефолты, примеры,
  зависимости, changelog, владелец).
- Декомпозиция: `app.json`, `i18n.json`, `theme.json`, `llm.json`, `batch.json`, `network.json`,
  `flashcards.json`, `reading.json`, `translation.json`, `edit.json`, `io.json`, `ingestion/*.json`,
  `media.json`, `pipeline.json`, `nlp.json`.
- Валидация Zod/JSON Schema при старте (**fail-fast**). Наслоение: defaults → env → user → runtime
  override (отражается в Settings).
- Автогенерация справки: `npm run docs:config` формирует `CONFIG_INDEX.md`.
- Анти-хардкод линт (скрипт `lint:anti-hardcode`).

---

## 4. Обработка текста (pipeline)

### 4.1 Ввод

- Поле ввода текста (дефолт до 15k символов; лимит — в конфиге).
- Источники расширяются адаптерами (см. §21/§13).

### 4.2 Сегментация

- Базовая единица чанка — **предложение**. Дефолт: **1 предложение/чанк**, макс \~300 токенов
  (конфиг).
- Сегментация — `latvian_sentence_tester:local`; HTTP-движок с таймаутом → **fallback** к primitive;
  выдаём `warnings` + `stats.fallbackUsed=true`.
- `SID = hash((docId||'') + ':' + start + ':' + end)` (engine-independent). **Manifest** строится
  **только** из списка `(sid,start,end,text)`.

### 4.3 Вызов LLM (tools + caching + stop reasons)

- **JSON-only через tools:** все LLM-вызовы идут с `{ system, messages, tools, tool_choice }`.
  Принудительное использование **единственного эмиттера карточек** через `tool_choice`. Чтение
  данных из **`tool_use.input`**, валидация Zod.
- **Parallel tools:** по умолчанию **выключено**. При включении — **все** `tool_result` размещаются
  **единым** следующим `user`-сообщением **до** любого текста (правила Anthropic).
- **Prompt caching:** стабилизируем `system` и определения `tools` (кешируемые блоки). Меняем
  преимущественно `messages.user`. Изменение `tool_choice` может инвалидировать кеш.
- **Stop reasons:** всегда проверяем `stop_reason`. `max_tokens` — **мягкая остановка** (не
  HTTP-ошибка):
  - **Single:** ретрай с увеличенным `max_tokens`.
  - **Batch:** **split-retry** только проблемных чанков; частичные успехи сохраняются; агрегация по
    SID.

- **Повтор/лимиты:** `429/5xx/timeout/network`→ экспоненциальный backoff + jitter; уважать
  `Retry-After`; ретраи идемпотентны.

### 4.4 Выходная модель (упрощённо)

- **Manifest:** список `{ sid, lv, sig }` (и таймкоды — для субтитров).
- **Card:** `{ unit:'word'|'phrase', base_form, base_translation?, contexts[], visible }`.
- **Context:** `{ sid, latvian, translation, forms[] }`; поле `translation` универсально (legacy
  `russian` читаем, но не пишем).
- Итоговый RU/целевой текст собирается **строго по порядку SID из manifest**.

---

## 5. Режимы UI

### 5.1 Text

- Ввод/очистка; переключатель **Использовать пакетную обработку**.
- Кнопка: без галочки — **Начать обработку**; с галочкой — **Начать пакетную обработку**.
- При batch — форма **Получить результаты batch** (`batch_id` + Загрузить). История с пометкой
  **просрочено** (≥29 дней).
- Перед любым стартом/загрузкой — `GET /api/health` (таймаут из конфига). При недоступности
  прокси/сети — **немедленный баннер**.

### 5.2 Flashcards

- Хоткеи: ←/→ навигация; Space/↑/↓ flip; `h` — скрыть (не удалять). При переходе — всегда **front**.
- Контексты: N по умолчанию + «показать больше» до M (оба — из конфигов). Подсветка целевой формы;
  LV и перевод; фразы/слова поддерживаются.
- UI: скругления/flip-анимация; шрифт **Noto Sans Display** (в конфиге). Задел: **TTS/Images**.

### 5.3 Reading

- Разные стили подсветки **слов** и **фраз**; при пересечении приоритет у **фразы**; легенда.
- Tooltip: **surface-form** перевод; позиционирование с учётом viewport (не «выпадать» за край,
  особенно на мобильных).
- Производительность: `tooltip.showDelayMs` (дефолт 0; может быть 3000 мс), debounce,
  cancel-on-leave, **single-flight** запросов.
- Контекстное меню (ПКМ/long-press) — пункты из конфига с плейсхолдерами `%w/%p/%b/%s/%sel/%lv/%tl`,
  белый список доменов.

### 5.4 Translation

- Просмотр перевода; нижняя панель: **слова (UAX-29)**, **символы (графемы)**, **предложения (по
  SID)**, **фразы** (unique|occurrences) — параметры в конфиге.

### 5.5 Edit

- Таблица с пагинацией (`pageSize` в конфиге), поиск (база/перевод; опционально контексты).
- **VISIBLE** (чекбокс) — глобально скрывает карточку (в т.ч. подсказки в Reading). **Master
  Visible** — массово (для всех/отфильтрованных).
- Правка **базового перевода** и **переводов контекстов** с **моментальной** пропагацией во все
  режимы; линк **«править контексты (N)»**.
- **Restore** — откат ко входному состоянию (см. §15). Красная **Clear** — только в верхнем хедере.

### 5.6 i18n/Theming

- Все UI-строки — из `/src/locales/{ru,uk,en}.json`; fallback `en`.
- `i18n.targetLanguage` управляет целевым языком перевода без модификации кода.
- Темы: light/dark/system; токены Tailwind/CSS vars.

---

## 6. Импорт/экспорт/восстановление

- **Import:** `JSON` (полный дамп состояния **с правками**) и `JSONL` (Anthropic Console). Превью
  diff; стратегии: `replace-all | merge-keep-local | merge-prefer-imported` (дефолт — в конфиге).
- **Export:** `JSON` (включая `appVersion`, `schemaVersion`, `exportedAt`, `locale`,
  `targetLanguage`). Задел: `Anki/Quizlet`.
- **Restore:** в Edit откатывает все ручные правки; для `reveal-on-peek` — сбрасывает
  видимость/метки; опциональный локальный бэкап + «Undo».

---

## 7. Batch-режим (Claude Message Batches)

- Переключатель/кнопка/форма/история/просрочка (см. §5.1).
- **Паритет с Messages API:** batch поддерживает те же фичи, **включая tools**; каждая JSONL-строка
  несёт тот же `params`.
- **Агрегация:** `custom_id == SID`; порядок строк JSONL не гарантирован; агрегировать **по SID**;
  статус сохранять: `succeeded|errored|canceled|expired`; диагностировать ошибки.
- **Поллинг:** адаптивные интервалы с jitter; уважать `Retry-After`.
- **Stop reasons:** см. §4.3 — `max_tokens` → bump/split-retry; частичные успехи не блокируются.

---

## 8. Ошибки, сеть, прокси

- **Pre-flight:** `/api/health` перед batch/загрузкой по `batch_id` и перед одиночными вызовами
  (таймаут — из конфига).
- **Коды:** `429` (лимиты), `413` (размер), `500` (внутренняя), `529` (перегрузка) → локализованные
  баннеры + политика ретраев (backoff + jitter). Прокси down/нет сети → **немедленный баннер**.
- Proxy опрашивает Anthropic с уважением к `Retry-After`; фронт — статус с адаптивным интервалом
  (0–10с: 1–2с; 10–60с: 3–5с; 1–10мин: 10–30с; далее: 30–60с).

---

## 9. Политика видимости карточек

- `flashcards.visibilityPolicy`: `all-visible` (дефолт) | `reveal-on-peek`.
- В `reveal-on-peek`: карточки стартуют невидимыми; **успешная подсказка** в Reading (с учётом
  задержки) делает карточку видимой; пометка `peeked` (стиль из конфигов).
- Ручные правки в Edit имеют приоритет.

---

## 10. Контекстное меню (Reading)

- ПКМ/long-press меню: пункты из конфига, плейсхолдеры `%w/%p/%b/%s/%sel/%lv/%tl`, белый список
  доменов, авто-URL-кодирование; открытие в новой вкладке.
- Независимо от задержки tooltip.

---

## 11. i18n/Целевой перевод/Темы

- См. §5.6 (закрепляем как нефункциональное требование: строки только из словарей; переключение
  языка/тем — без перекомпиляции).

---

## 12. Нефункциональные требования

- **Производительность:** не блокировать UI; ленивые модули; виртуализация списков; ограничение
  параллельных запросов; `showDelayMs` для Reading.
- **Надёжность:** ретраи с backoff; защита от дубликатов (**single-flight**) для подсказок;
  **идемпотентность** повторов.
- **Безопасность:** белые списки доменов; ключи API — только на прокси; профили — шифрование
  (AES-GCM), HttpOnly tokens, CSRF.
- **Тестирование:** unit + e2e (Cypress) сценарии на критичные пути; golden/property-based для
  манифеста/SID/FSM.
- **Доступность:** клавиатурная навигация, aria-метки, контрастность тем, мобильные popover’ы.
- **Документация:** RU-доки для конфигов; **tool-use.md** как рабочая политика инструментов;
  AGENT.md/Codex.md — правила кодогенерации/рефакторинга.

---

## 13. Интеграции LLM/MT/OCR/Media

- **LLMAdapter:** Anthropic (дефолт), расширяемость до OpenAI и др. без ломки API через DI.
- **MT/Local:** интерфейсы `LemmaAdapter`, `DictionaryAdapter`, `MTAdapter` (Helsinki-NLP/TildeLM) —
  переключается конфигом (`pipeline.mode`).
- **OCR:** Tesseract (wasm/локально) → нормализованный текст.
- **Media/Player:** HTML5/HLS; `MediaAnchor` связывает SID с таймкодами; последующая подсветка в
  Reading.

---

## 14. API прокси (ESM)

- `/api/health` — статус.
- `/api/claude/test` — пробный вызов.
- `/api/batch/create | /status | /result` — обёртки Anthropic (те же `params`, что и в Messages API,
  incl. `tools`).
- Единый формат ошибок; маппинг кодов/советов для UI.
- Модельные имена (например, `claude-3-haiku-20240307`), таймауты, интервалы — **только из
  конфигов**.

---

## 15. Restore/Undo

- В Edit: **Restore** откатывает ко входному состоянию (после первой обработки).
- Опция `io.restore.makeBackupBefore` — локальный бэкап и «Undo» в течение временного окна (конфиг).
- Для `reveal-on-peek`: все карточки → `visible=false`, `peeked` очищается; пользовательские
  добавления/удаления возвращаются к исходному.

---

## 16. Конфиги (сводка ключей)

- `flashcards.json`: `contextsDefault`, `contextsExpandLimit`, `keybinds` (←/→, Space/↑/↓, `h`),
  `ui` (rounded/flip/font), `visibilityPolicy`, `peekHighlight`.
- `reading.json`: `highlight.word/phrase`, `tooltip`
  (font/opacity/maxWidth/mobileMaxWidth/offset/boundaryPadding/enterMs/leaveMs/showDelayMs/debounceMs/cancelOnLeave/request.strategy).
- `translation.json`: `stats.words/characters/sentences/phrases`.
- `edit.json`: `pageSize`, `search.includeContexts`, `bulk.masterVisibleToggle`, `propagation.live`.
- `io.json`: `import.allowed/defaultMerge/maxFileSizeMB`, `export.formats/anki/quizlet`,
  `restore.enabled/confirm/makeBackupBefore`.
- `actions.json`: меню Reading (пункты, плейсхолдеры, allowedHosts).
- `ingestion/*.json`: pdf/ocr/images/subtitles/youtube.
- `media.json`: pre/post-roll, хоткеи, провайдер.
- `llm.json`, `batch.json`, `network.json`, `i18n.json`, `theme.json`, `pipeline.json`, `nlp.json`.

---

## 17. Приёмка (основные критерии)

- **Batch UI:** переключатель/кнопка/форма/история/просрочка; мгновенные ошибки под переключателем.
- **Ошибки сети/прокси:** pre-flight; баннеры для `429/413/500/529/expired/нет сети`.
- **Flashcards:** хоткеи; сброс flip при навигации; контексты N/M; подсветка формы; стили из
  конфигов; TTS/Images — флаги.
- **Reading:** стили слов/фраз; приоритет фраз; tooltip (surface-form, viewport-safe,
  задержки/дедупликация); контекстное меню; (опц.) hover-TTS.
- **Translation:** статистика по конфигу; Unicode-устойчивость (графемы/UAX-29).
- **Edit:** VISIBLE/Master Visible; правка базового/контекстов с live-пропагацией; «править
  контексты (N)»; Restore/Undo.
- **Import/Export:** JSON↔JSONL; превью/стратегии; экспорт включает правки; ре-импорт воспроизводит
  состояние.
- **i18n/theme:** все строки из словарей; переключение языка/темы работает.
- **Tool-use:** JSON-only через tools; `tool_choice` принудительный; парсинг `tool_use.input` + Zod;
  **prompt caching** соблюдено.
- **Stop reasons:** `max_tokens` обрабатывается bump/split-retry; частичные успехи не теряются.
- **Конфиги:** валидируются; хардкоды отсутствуют; codeframe-линт в CI.

---

## 18. Тестирование

- **Unit:** подсчёт слов/символов/фраз; tooltip controller (delay/debounce/cancel/single-flight);
  парсер JSONL; стратегии merge; reducers Card/Context; anti-hardcode; нормализация ошибок.
- **Integration:** batch create/status/result; pre-flight и баннеры;
  Edit→Flashcards/Reading/Translation пропагация; tool-use парсинг (`tool_use.input`).
- **Golden/Property-based:** порядок SID/manifest; перестановки JSONL; дубликаты/пропуски SID; FSM
  детерминизм.
- **E2E (Cypress):** сценарии всех режимов; Import/Export/Restore; `reveal-on-peek`; stop-reasons
  UX.

---

## 19. Ограничения и ссылки

- Приоритет документов: **официальные Anthropic docs → `TechnicalGuidesForClaudeAPIv2.0.md` →
  `Message Batches.md`/`MessageBatches2.md` → `tool-use.md` (операционная политика)**.
- Будущие адаптеры (OpenAI, TTS/Images/YouTube/Local MT) внедряются без модификации существующей
  логики через DI/флаги (config-first).

---

## 20. План релизов (вехи)

- **MVP (v1):** Text/Flashcards/Reading/Translation/Edit; batch toggle; ошибки/баннеры; i18n/themes;
  Import/Export JSON; конфиги + валидация; **tool-use JSON-only (эмиттер, `tool_choice`, Zod),
  prompt caching hygiene**.
- **v1.1:** JSONL импорт; Restore/Undo; контекстное меню; reveal-on-peek; **UX для stop reasons
  (баннеры/Retry), split-retry на batch**.
- **v1.2:** PDF/OCR/Images/Subtitles ingestion (без ломки manifest/SID/tool-use).
- **v1.3:** Media follow-highlight + хоткеи; экспорт Anki/Quizlet.
- **v2.0:** Профили/подписки/синхронизация; локальные NLP/MT; YouTube captions; (опц.)
  token-efficient tool use.

---

## 21. Приложения

- **AGENT.md / Codex.md / src/\*/AGENT.md:** правила кодогенерации, анти-хардкод, i18n/Theming,
  специфика Flashcards/Reading, config-first, tool-use.
- Образцы Zod-схем и RU-доков для конфигов; примеры запросов c `tools/tool_choice` и разбором
  `tool_use.input`.

---
