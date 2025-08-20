# Техническое задание (TRS) — Latvian Language Learning (flashcards‑v3)

**Версия:** 5.0  
**Дата:** {{today}}  
**Репо:** https://github.com/nn1k4/flashcards-v3  
**Ядро архитектуры:** SPA (React + TypeScript, Tailwind), Node.js proxy (ESM), конфиги‑first,
адаптерная система LLM/MT/OCR/медиа.  
**Целевая платформа:** desktop и mobile web (mobile‑first), задел на нативные iOS/Android клиенты.

---

## 1. Обзор

### 1.1 Цели

- Изучение латышского через персональные карточки, режимы чтения и перевода.
- Стабильная пакетная обработка длинных текстов (Claude Message Batches), с прозрачным UI статуса и
  офлайн‑просмотром результатов.
- Максимальная конфигурируемость (модели, лимиты, хоткеи, i18n, темы), **без хардкодов**.
- Готовность к расширениям: PDF/OCR, субтитры/медиа‑синхронизация, локальные NLP/MT,
  профили/подписки, TTS/изображения.

### 1.2 Область

- Веб‑приложение с режимами **Text → Flashcards → Reading → Translation → Edit**.
- Node‑proxy для LLM и batch API; локальная интеграция морфологии/сегментации.
- Импорт/экспорт/восстановление данных.
- i18n UI и целевого языка перевода; темы light/dark/system.

---

## 2. Архитектура и стек

- **Frontend:** React + TypeScript, Vite, Tailwind; Framer Motion (микро‑анимации); ESLint +
  Prettier (или Biome).
- **Backend‑proxy:** Node.js **v24.6.0**, npm **v11.5.1**, ESM‑модули; Express/Fastify; `dotenv`.
- **Стандарты кодовой базы:**
  - Конфиги (JSON/TS + Zod) — единственный источник значений. Магические числа запрещены.
  - Линт‑вывод **eslint-formatter-codeframe** (если не установлен:
    `npm i -D eslint-formatter-codeframe`; запуск: `npm run lint -- --format codeframe`).
  - Тесты: unit + integration + **E2E (Cypress)**.
- **Сегментация/морфология:** `latvian_sentence_tester` как **:local** модуль (первый этап).
- **LLM адаптеры:** базовый — Anthropic (Claude). Задел на OpenAI и др. через интерфейсы.
- **Хранилище:** in‑memory + экспорт/импорт; серверная синхронизация — на этапе профилей.
- **Темизация:** Tailwind tokens + CSS vars; dark/light/system.

---

## 3. Конфиг‑политика (обязательная)

- RU‑доки для каждого конфига в `/docs/configs/*.md` (назначение, ключи, дефолты, примеры,
  зависимости, changelog, владелец).
- Декомпозиция: `app.json`, `i18n.json`, `theme.json`, `llm.json`, `batch.json`, `network.json`,
  `flashcards.json`, `reading.json`, `translation.json`, `edit.json`, `ingestion/*.json`,
  `media.json`, `pipeline.json`, `nlp.json`, `io.json` и т.д.
- Валидация Zod/JSON Schema при старте (**fail‑fast**).
- Наслоение: defaults → env → user → runtime override; источник показывается в Settings.
- Автогенерация справки: `npm run docs:config` формирует `CONFIG_INDEX.md`.
- Анти‑хардкод линт (скрипт `lint:anti-hardcode`).

---

## 4. Обработка текста (pipeline)

### 4.1 Ввод

- Поле ввода текста (до 15k символов, лимит в конфиге).
- Источники расширяются адаптерами (см. §21).

### 4.2 Сегментация

- Предложение — базовая единица чанка. Дефолт: **1 предложение/чанк**, макс ~300 токенов (конфиг).
- Сегментация предложения — локальный модуль `latvian_sentence_tester`.

### 4.3 Вызов LLM

- **JSON‑только** ответы (строго структурированный output).
- Поштучная обработка (по умолчанию) **или** пакетная (Message Batches).
- Строгая обработка ошибок/ретраев/лимитов (§12).

### 4.4 Выходная модель (упрощённо)

- `Manifest`: список `SID` c текстом/метаданными (и таймкодами для субтитров).
- `Card`: `{ id, unit: 'word'|'phrase', base_form, translation, forms[], contexts[] }`.
- `Context`: `{ sid, latvian, translation, lang, forms[] }` — **translation/lang** универсальны
  (legacy `russian` читаем, но не записываем).

---

## 5. Режимы UI

### 5.1 Text

- Ввод/очистка; переключатель **Использовать пакетную обработку**.
- Кнопка: без галочки — **Начать обработку**; с галочкой — **Начать пакетную обработку**.
- При batch показ формы **Получить результаты batch** (поле `batch_id` + Загрузить). История
  batch_id с пометкой **просрочено** (старше 29 дней).
- Перед любым стартом/загрузкой — `GET /api/health` (таймаут из конфига). При недоступности прокси —
  **немедленный баннер**.

### 5.2 Flashcards

- Хоткеи: ←/→ навигация; Space/↑/↓ flip; `h` — скрыть (не удалять).
- Перед переходом на другую карточку — всегда показывать **front**.
- Контексты: сначала N, «показать больше» до M (оба из конфигов). Подсветка целевой формы;
  LV/перевод.
- UI: округления/flip‑анимация/шрифты (**Noto Sans Display**) — из конфигов.
- Политика видимости: `all-visible` (дефолт) | `reveal-on-peek` (§9).
- Задел: **TTS**/**Images** адаптеры (по флагу в конфиге).

### 5.3 Reading

- Подсветка **слов** (стиль A) и **фраз** (стиль B) с легендой. При пересечении активируется
  **фраза**.
- Подсказка (tooltip) показывает **поверхностную форму** + пометки; позиционирование с учётом
  viewport; на мобильных — popover/bottom‑sheet.
- Производительность: задержка показа `tooltip.showDelayMs` (дефолт 0; можно 3000 мс), debounce,
  cancel on leave, single‑flight.
- **Контекстное меню** (ПКМ/long‑press) — конфигурируемые действия с плейсхолдерами
  `%w/%p/%b/%s/%tl` и белым списком доменов (§20).
- (Опционально) TTS при hover — флаг в конфиге.

### 5.4 Translation

- Просмотр связанного перевода. Внизу — статистика: **слова (UAX‑29)**, **символы (графемы)**,
  **предложения (по SID)**, **фразы** (unique|occurrences) — параметры в конфиге.

### 5.5 Edit

- Список карточек с пагинацией (`pageSize` из конфига), поиск (базовая форма/перевод; опционально —
  по контекстам).
- **VISIBLE** (чекбокс) — глобально скрывает карточку (в т.ч. отключает подсказки в Reading).
- **Master Visible** — массово для всех/отфильтрованных.
- Правка **базового перевода** и **переводов контекстов** с **моментальной** пропагацией в
  Flashcards/Reading/Translation.
- Вместо столбца UNIT — ссылка **«править контексты (N)»** (модал/таблица).
- **Restore** — откат ко входному результату обработки (см. §15).
- Красная **Clear** — только в верхнем хедере.

### 5.6 i18n/Theming

- Все UI‑строки из `/locales/{ru,uk,en}.json`; fallback `en`.
- `i18n.targetLanguage` управляет языком перевода карточек/Reading/Translation.
- Тема: light/dark/system (уважение `prefers-color-scheme`).

---

## 6. Импорт/экспорт/восстановление

- **Import:** `JSON` (полный дамп состояния **с правками**) и `JSONL` (Anthropic batches console).
  Превью изменений; стратегии: `replace-all | merge-keep-local | merge-prefer-imported` (дефолт —
  конфиг).
- **Export:** `JSON` (метаданные app/schema/locale/targetLanguage) + задел на `Anki/Quizlet`.
- **Restore:** в Edit откатывает все ручные правки; корректирует видимость по политике; опциональный
  локальный бэкап + «Undo».
- Валидация схем; i18n‑ошибки; отчёты о конфликте/пропусках.

---

## 7. Batch‑режим (Message Batches)

- Переключатель «Использовать пакетную обработку». Кнопка «Начать пакетную обработку».
- Форма «Получить результаты batch»: поле `batch_id`, «Загрузить», история ID, пометка
  **просрочено** (≥29 дней).
- UI‑ошибки появляются **сразу** (прокси, сеть, 429/413/500/529, expired).
- **Документы:** `TechnicalGuidesForClaudeAPIv2.0.md` — **приоритетный** источник; при расхождении с
  `Message Batches.md`/`MessageBatches2.md` — руководствуемся Guide v2.0.
- Лимиты/ретраи — из конфига (`batch.json`).

---

## 8. Ошибки, сеть, прокси

- **Pre‑flight:** `/api/health` перед стартом batch/загрузкой по `batch_id` и перед одиночными
  вызовами (таймаут из конфига).
- Ошибки: `429` (лимиты), `413` (размер), `500` (внутренняя), `529` (перегрузка) — локализованные
  баннеры и backoff; разрыв сети/прокси down — немедленный баннер.
- Proxy polling Anthropic с respect к `Retry‑After`; фронт polling статуса с адаптивным интервалом
  (0–10с: 1–2с; 10–60с: 3–5с; 1–10мин: 10–30с; далее: 30–60с) + jitter.
- Логи в консоли **не заменяют** пользовательские баннеры.

---

## 9. Политика видимости карточек

- `flashcards.visibilityPolicy`: `all-visible` (дефолт) | `reveal-on-peek`.
- В `reveal-on-peek`: все карточки стартуют невидимыми; после успешной подсказки в Reading (учитывая
  `showDelayMs`) — становятся видимыми (`peeked`‑подсветка в Reading).
- Ручная правка в Edit имеет приоритет над автоматикой.

---

## 10. Контекстное меню (Reading)

- ПКМ/long‑press: конфигурируемые пункты с плейсхолдерами `%w/%p/%b/%s/%sel/%lv/%tl`,
  автокодирование, белый список доменов; открытие в новой вкладке.
- Независимо от задержки tooltip.

---

## 11. i18n/Целевой перевод/Темы

- Все строки — из словарей; анти‑хардкод тесты.
- `targetLanguage` влияет на Translation/Reading/Flashcards без правок кода.
- Темы из токенов; `dark:` классы Tailwind.

---

## 12. Нефункциональные требования

- **Производительность:** не блокировать UI; ленивые модули; виртуализация списков; ограничение
  параллельных запросов; `showDelayMs` для Reading.
- **Надёжность:** ретраи с backoff; защита от дубликатов (single‑flight) в подсказках.
- **Безопасность:** белые списки доменов; ключи API — только на прокси; профили — шифрование;
  CORS/CSRF best practices.
- **Тестирование:** unit + e2e (Cypress) сценарии на все критичные пути.
- **Доступность:** клавиатурная навигация, aria‑метки, контраст в темах.
- **Документация:** RU‑доки для конфигов и архитектуры; AGENT.md/Codex.md — правила
  кодогенерации/рефакторинга.

---

## 13. Интеграции LLM/MT/OCR/Media

- **LLMAdapter:** Anthropic (по умолчанию), задел OpenAI и др.
- **MT/Local:** интерфейсы `LemmaAdapter`, `DictionaryAdapter`, `MTAdapter` (Helsinki‑NLP/TildeLM) —
  переключаемо конфигом (`pipeline.mode`).
- **OCR:** Tesseract (wasm/локально) → нормализованный текст/блоки.
- **Media/Player:** HTML5/HLS; `MediaAnchor` связывает SID с таймкодами.

---

## 14. API прокси (ESM)

- `/api/health` — статус.
- `/api/claude/test` — пробный вызов.
- `/api/batch/create | /status | /result` — обёртки Anthropic.
- Единый формат ошибок; маппинг кодов/советов для UI.
- Все модельные имена (напр. `claude-3-haiku-20240307`) и таймауты — **только из конфигов**.

---

## 15. Restore/Undo

- В Edit: **Restore** — откат ко входному состоянию (после первой обработки).
- При включённом `io.restore.makeBackupBefore` — локальный бэкап и «Undo» в течение окна времени
  (например, 5 мин).
- В `reveal-on-peek`: видимость всех карточек вновь `false`; `peeked` очищается; пользовательские
  добавленные карточки удаляются, удалённые — возвращаются.

---

## 16. Конфиги (сводка ключей)

- `flashcards.json`: `contextsDefault`, `contextsExpandLimit`, `keybinds`, `ui` (rounded/flip/font),
  `visibilityPolicy`, `peekHighlight`.
- `reading.json`: `highlight.word/phrase`, `tooltip`
  (font/opacity/maxWidth/mobileMaxWidth/offset/boundaryPadding/easing/enterMs/leaveMs/\*delay/\*debounce/\*cancelOnLeave/\*strategy).
- `translation.json`: `stats.words/characters/sentences/phrases`.
- `edit.json`: `pageSize`, `search.includeContexts`, `bulk.masterVisibleToggle`, `propagation.live`.
- `io.json`: `import.allowed/defaultMerge/maxFileSizeMB`, `export.formats/anki/quizlet`,
  `restore.enabled/confirm/makeBackupBefore`.
- `actions.json`: меню Reading (пункты, плейсхолдеры, allowedHosts).
- `ingestion/*.json`: pdf/ocr/images/subtitles/youtube.
- `media.json`: pre/post‑roll, хоткеи, провайдер.
- `llm.json`, `batch.json`, `network.json`, `i18n.json`, `theme.json`, `pipeline.json`, `nlp.json`.

---

## 17. Приёмка (основные критерии)

- **Batch UI:** переключатель/кнопка/форма/история/просрочка; мгновенные ошибки под переключателем.
- **Ошибки сети/прокси:** pre‑flight, баннеры при 429/413/500/529/expired/нет сети.
- **Flashcards:** хоткеи; сброс flip при навигации; контексты N/M; подсветка формы; стили из
  конфигов; TTS/Images отключаемы флагами.
- **Reading:** стили слов/фраз, приоритет фраз; tooltip по surface; позиционирование без выхода за
  экран; задержки/дедупликация; правый клик меню; (опц.) hover‑TTS.
- **Translation:** статистика по конфигу, устойчивость к Unicode.
- **Edit:** VISIBLE и Master Visible; правка базового/контекстов с live‑пропагацией; «править
  контексты (N)»; Restore/Undo.
- **Import/Export:** JSON↔JSONL; превью/стратегии; экспорт включает пользовательские правки;
  ре‑импорт восстанавливает идентичное состояние.
- **i18n/theme:** все строки из словарей; смена языка/темы работает.
- **Конфиги:** валидируются; хардкоды отсутствуют; codeframe‑линт в CI.

---

## 18. Тестирование

- **Unit:**
  - подсчёт слов/символов/фраз; tooltip controller (задержка/отмена/single‑flight);
  - парсер JSONL; стратегии merge; reducers Card/Context; anti‑hardcode.
- **Integration:** batch create/status/result; pre‑flight и баннеры ошибок;
  Edit→Flashcards/Reading/Translation пропагация.
- **E2E (Cypress):** основные пользовательские сценарии всех режимов; Import/Export/Restore;
  `reveal-on-peek`.

---

## 19. Ограничения и ссылки

- Следовать **TechnicalGuidesForClaudeAPIv2.0.md** (приоритет). При конфликте с `Message Batches.md`
  / `MessageBatches2.md` — применять v2.0.
- Будущие адаптеры (OpenAI, TTS/Images/YouTube/Local MT) — реализуются без модификации существующей
  логики через DI и флаги.

---

## 20. План релизов (вехи)

- **MVP (v1):** Text/Flashcards/Reading/Translation/Edit; batch toggle; ошибки/баннеры; i18n/themes;
  Import/Export JSON; конфиги + валидация.
- **v1.1:** JSONL импорт; Restore/Undo; контекстное меню; reveal‑on‑peek.
- **v1.2:** PDF/OCR/Images/Subtitles ingestion.
- **v1.3:** Media follow‑highlight + хоткеи; экспорт Anki/Quizlet.
- **v2.0:** Профили/подписки/синхронизация; локальные NLP/MT; YouTube captions.

---

## 21. Приложения

- **AGENT.md / Codex.md**: правила кодогенерации, анти‑хардкод, i18n/Theming, Flashcards/Reading
  специфика, конфиги‑first.
- Образцы схем Zod и RU‑доков для конфигов.
