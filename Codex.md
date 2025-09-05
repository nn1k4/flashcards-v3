# Flashcards-v3 — Code & UX Codex (v5.1)

> Каноничные правила реализации UI/UX, структуры кода и качества. Документ комплементарен
> **AGENT.md**, отражает требования **TRS** и поэтапные планы. Любая правка кода должна
> соответствовать этим правилам.

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Plans: `doc/plan/plan_1.md … plan_5.md`
- Best Practices: `doc/best_practices/*` (приоритет: `TechnicalGuidesForClaudeAPIv2.0.md`,
  `tool-use.md`)

---

## 0) Золотые правила

1. **Manifest/SID — источник истины.** Порядок/состав LV-предложений только из манифеста; сборка
   перевода/контекстов детерминирована.
2. **JSON-only через tools.** Все LLM-ответы — строго структурированный JSON через **Claude
   tools** + Zod-валидация; гибридный вывод запрещён.
3. **Config-first.** Никаких хардкодов: модели, лимиты, тайминги, хоткеи, стили, размеры, локали —
   из `/config/*.json(.*)`; Zod/JSON-Schema.
4. **FSM-first.** UI — проекция конечного автомата (idle→submitted→in_progress→ready/failed).
5. **i18n/Theming.** Все UI-строки в `/src/locales/*`; темы через токены Tailwind/CSS vars
   (`light|dark|system`).
6. **Ошибки — пользователю сразу.** Баннеры в UI обязательны (консоль — вторично).
7. **Node 24.6.0 (ESM) + npm 11.5.1.** Линт-вывод: `eslint-formatter-codeframe`.

---

## Output Contract (для ответов Codex)

Используйте структуру:

- <analysis>: краткий разбор причин/контекста
- <plan>: минимальные шаги
- <changeset>: git unified diff только по затронутым файлам
- <tests>: команды/покрытие тестами
- <docs>: какие доки обновить
- <commit>: conventional commit
- <postchecks>: проверки (lint/type-check/tests)

Пример (сокращённо):

```
1) <analysis> …
2) <plan> …
3) <changeset> …
4) <tests> npm run test
5) <docs> …
6) <commit> feat(...): …
7) <postchecks> npm run type-check && npm run lint -- --format codeframe
```

### Sync/branch & baseline checks (Windows)

Перед началом работы локально (PowerShell):

```
git status
git pull --rebase
npm ci
npm run type-check
npm run test
npm run lint -- --format codeframe
```

Это гарантирует зелёную базу (TS strict, тесты, линт) перед внесением изменений.

## 1) Tool-use & Prompt Caching (обязательно к исполнению)

**Цель:** гарантировать JSON-структуру, снизить стоимость/латентность, корректно обрабатывать
stop-reasons.

- **Forcing tools:** каждый вызов Claude идёт с `tools` и фиксированным `tool_choice` (эмиттер
  карточек/структуры). Парсим **первый** `tool_use` нужного имени → берём `input` → валидируем Zod.
- **Parallel tools:** по умолчанию **выключено**. Если включаем — **все** `tool_result` возвращаем
  **единым** user-сообщением и **в начале** контента.
- **Stop reasons:** различаем `stop_reason` vs HTTP-ошибки. Для `max_tokens`:
  - single → **bump** лимита и ретрай;
  - batch → **split-retry** проблемного чанка; частичные успехи не блокируются.

- **Batch parity:** Message Batches поддерживает те же поля/фичи, что и Messages API (incl. tools).
- **Prompt caching:** стабилизируем `system` и определения `tools` (best-effort кеш); смена
  `tool_choice` может инвалидировать кеш.

Подробности: `doc/best_practices/tool-use.md`,
`doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md`.

---

## 2) Архитектура фронтенда

**Стек:** React 18 + TypeScript + Vite + Tailwind + Framer Motion + Cypress.

**Организация `src/` (feature-first):**

```
components/
  Flashcards/
  Reading/
  Translation/
  Edit/
  ImportExport/
  Banners/
  Media/              # v1.3
hooks/                # useX per домен; эффекты/HTTP только тут
stores/               # cardStore, contextStore, uiStore
utils/                # manifest.ts, aggregator.ts, fsm.ts, textStats.ts, tooltip.ts
api/                  # client.ts (HTTP), schema.ts (Zod DTO)
locales/              # ru.json, uk.json, en.json, ...
styles/               # tokens.css, tailwind setup
```

**Принципы:**

- Компоненты — «тонкие»: минимум логики, без сетевых вызовов.
- Бизнес-логика/эффекты — в hooks/stores; отмена, идемпотентность, single-flight.
- Barrel-экспорт на уровень фичи (`index.ts`).
- Селекторы/вычисления мемоизируются.

---

## 3) Состояние и события

- **Stores:** `CardStore`, `ContextStore`, `UiStore`.
- **События:** `CARD_UPDATED`, `CONTEXT_UPDATED`, `CARD_VISIBILITY_CHANGED`, `IMPORT_APPLIED`,
  `RESTORE_APPLIED`, `BATCH_STATUS_CHANGED`.
- **FSM:** отдельные машины для batch-процесса и tooltip-контроллера. Переходы детерминированы.

---

## 4) UI режимов (MVP)

### 4.1 Text

- Поле ввода (лимит в конфиге), **Очистить**.
- Переключатель **Использовать пакетную обработку** → — меняет лейбл на «Начать пакетную обработку»;
  — показывает форму «Получить результаты batch» (input `batch_id`, Загрузить, история с меткой
  **просрочено** ≥29 дней).
- Перед стартом/загрузкой — **pre-flight `/api/health`**; при ошибке — немедленный баннер.

### 4.2 Flashcards

- **Хоткеи:** `ArrowLeft/ArrowRight` — навигация; `Space|ArrowUp|ArrowDown` — flip; `h` — скрыть.
- Переход к другой карточке всегда открывает **front**.
- Контексты: показывать `N` по умолчанию; «Показать больше» до `M` (оба — из конфигов).
- Подсветка целевой формы; LV + перевод.
- UI: округлые углы, анимация flip (Framer Motion), шрифт **Noto Sans Display** — всё из конфигов.
- Политика видимости: `all-visible` (дефолт) | `reveal-on-peek`.

### 4.3 Reading

- Различная подсветка **слов** и **фраз**; при пересечении **фраза приоритетна**; легенда.
- Tooltip: **surface-форма** и перевод; позиционирование внутри viewport; мобильный
  popover/bottom-sheet.
- Производительность: `tooltip.showDelayMs` (0..3000), `debounceMs`, `cancelOnLeave=true`,
  **single-flight**, `request.strategy="afterDelay"` (до порога — без запросов).
- (v1.1) **Контекстное меню** (ПКМ/long-press) из `config/actions.json` с плейсхолдерами
  `%w/%p/%b/%s/%sel/%lv/%tl` и белым списком доменов.
- (опц.) hover-TTS — флаг в конфиге.

### 4.4 Translation

- Нижняя панель статистик: **слова (UAX-29)**, **символы (графемы)**, **предложения (SID)**,
  **фразы** (unique|occurrences). Всё через `Intl.Segmenter`, параметры — из конфигов.

### 4.5 Edit

- Таблица с пагинацией (`pageSize`), поиск по базовой форме/переводу (опц.: по контекстам).
- **VISIBLE** + **Master Visible** (все/текущий фильтр).
- Правка **базового перевода** и **переводов контекстов**; **моментальная** пропагация в
  Flashcards/Reading/Translation.
- Ссылка **«править контексты (N)»** (модал/таблица).
- **Restore** (v1.1): откат к результату первичной обработки; опц. Undo (локальный бэкап).

---

## 5) Импорт/Экспорт/Restore

- **Import JSON:** полный снапшот с правками; превью diff; стратегии
  `replace-all | merge-keep-local | merge-prefer-imported` (дефолт — из конфига).
- **Import JSONL (v1.1):** потоковый парсер; `custom_id==SID`; порядок строк не важен; отчёт
  imported/skipped/invalid; офлайн-валиден после 29 дней.
- **Export JSON:** включает все правки + метаданные (`appVersion`, `schemaVersion`, `exportedAt`,
  `locale`, `targetLanguage`).
- **Restore:** откат ко входному состоянию; в `reveal-on-peek` — сброс видимости/`peeked`; Undo при
  включённом бэкапе.
- (v1.3) Экспорт **Anki/Quizlet** (CSV/TSV) с параметрами из конфигов.

---

## 6) Ошибки/Сеть/Batch UX

- **Pre-flight `/api/health`** перед стартом single/batch и загрузкой `batch_id`; нет сети/прокси
  down → **немедленный баннер**.
- **Коды:** `429` (лимиты), `413` (размер), `500` (внутренняя), `529` (перегрузка), `expired` —
  локализованные баннеры + советы/ретраи.
- **Polling статуса:** адаптивно (0–10с: 1–2с; 10–60с: 3–5с; 1–10мин: 10–30с; далее: 30–60с) +
  jitter; прокси уважает `Retry-After` при опросе Anthropic.
- Приоритет документации: `TechnicalGuidesForClaudeAPIv2.0.md` >
  `Message Batches.md`/`MessageBatches2.md`.

---

## 7) Конфиги и схемы

- Все настройки — в `/config/` + **RU-доки** `doc/configs/*.md` (назначение, ключи, дефолты,
  примеры, зависимости, changelog, владелец).
- Валидация при старте: `npm run validate:config` (Zod/JSON-Schema).
- Индекс конфигов: `npm run docs:config`.
- Анти-хардкод в CI: `npm run lint:anti-hardcode`.
- Ключевые файлы: `flashcards.json`, `reading.json`, `translation.json`, `edit.json`, `io.json`,
  `batch.json`, `llm.json`, `network.json`, `i18n.json`, `theme.json`, `media.json`, `actions.json`,
  `pipeline.json`, `nlp.json`.

**Запрещено:**

- Хардкод модели (напр., `claude-3-haiku-20240307`) — всегда через `config/llm.json`.
- Хардкод таймингов/лимитов/кейкодов/стилей — только через конфиги.
- Сырые строки UI вне i18n.

---

## 8) Стили/темы/типографика

- Tailwind + CSS vars; темы `light|dark|system`.
- Базовый шрифт: **Noto Sans Display** (конфиг).
- Разные стили подсветки для **слов** и **фраз**; цвета/opacity — из конфигов.
- Tooltip/меню не выходят за viewport; mobile — bottom-sheet; густота кликабельных целей.

---

## 9) Доступность и клавиатура

- Обязательные хоткеи (Flashcards: ←/→, Space/↑/↓, `h`; Media v1.3:
  play/pause/back/forward/prev/next).
- Видимый фокус; aria-атрибуты; контраст темы достаточный.
- Легенда подсветок в Reading; скринридер-тексты на иконках.

---

## 10) Тестирование и качество

- **Unit:** tooltip controller (delay/cancel/single-flight), text stats (Intl.Segmenter), reducers,
  JSON/JSONL import/merge, export/restore.
- **Integration/E2E (Cypress):** happy-path по всем режимам; ошибки сети/прокси; batch-история;
  reveal-on-peek; контекстное меню; импорт/экспорт.
- **Golden tests:** порядок предложений сохраняется; Export→Re-import даёт идентичное состояние.
- **Property-based:** инварианты манифеста/агрегации.
- **Линт:** `eslint-formatter-codeframe` (контекст в отчётах).

**CI воркфлоу:** `lint`, `test`, `e2e`, `validate:config`, отчёт KPI.

---

## 11) Конфиги и документация

- Все настройки — в `/config/` + **RU‑доки** `doc/configs/*.md`
  (назначение/ключи/дефолты/примеры/зависимости/валидация/pitfalls/changelog).
- Валидация: `npm run validate:config` (Zod, fail‑fast отчёт).
- Индекс: `doc/configs/CONFIG_INDEX.md` (таблица всех конфигов). (Если настроено —
  `npm run docs:config`).
- Анти‑хардкод: `npm run lint:anti-hardcode` (запрещает модели/интервалы/кейкоды/лимиты в коде).
- Ключевые файлы: `app.json`, `i18n.json`, `theme.json`, `network.json`, `llm.json`, `batch.json`,
  `flashcards.json`, `reading.json`, `translation.json`, `edit.json`, `io.json`.

---

## 12) Сеть/клиент

- **HTTP-клиент** (`api/client.ts`): fetch wrapper + Zod-валидация DTO; таймауты/ретраи из
  `config/network.json`; уважать `Retry-After`.
- **LLM/Batch API**: только через прокси; ключи не попадают на фронт.
- **Анти-дубликаты:** single-flight для повторных hover-запросов; отмена на `mouseleave`.

---

## 13) Контекстное меню (v1.1)

- Конфиг `config/actions.json`: пункты
  `{id,titleKey,type,enabled,urlTemplate/payload,target,security.allowedHosts}`.
- Плейсхолдеры: `%w,%p,%b,%s,%sel,%lv,%tl`; автокодирование параметров; `target="_blank"`,
  `rel="noopener noreferrer"`.

---

## 14) Media (v1.3)

- `PlayerAdapter` (HTML5): `mount/play/pause/seek/currentTime/destroy`; события
  `timeupdate|ended|error`.
- `MediaAnchorsStore`: `{sid,start,end}`; follow-highlight → Reading; pre/post-roll, хоткеи/жесты —
  из `media.json`.

---

## 15) Профили/подписки/локальный NLP (v2.0)

- Сервер: Fastify/Express + Prisma (Postgres/SQLite dev).
- Auth: JWT (HttpOnly), CSRF защита.
- Ключи провайдеров — шифрование (AES-GCM), не возвращаются в явном виде.
- Локальный NLP/MT: `pipeline.mode = llm|local|hybrid` (см. TRS §24).

---

## 16) Git/PR процесс

Каждый PR указывает релиз/этап (`plan_X.md`) + ссылки на § TRS и изменённые конфиги/доки.

**Чек-лист PR:**

- [ ] Нет хардкодов; все значения — из конфигов.
- [ ] Zod-схемы/доки обновлены.
- [ ] i18n-ключи добавлены; темы корректны.
- [ ] Unit + E2E зелёные; golden/property-based где нужно.
- [ ] Баннеры ошибок покрывают негативные пути.
- [ ] README/AGENT/Codex актуальны.

---

## 17) Примеры (сокращённые)

**Tooltip controller:**

```ts
const d = cfg.reading.tooltip.showDelayMs;
const deb = cfg.reading.tooltip.debounceMs;
const cancel = cfg.reading.tooltip.cancelOnLeave;

export function useTooltipController() {
  const timer = useRef<number | undefined>();
  const inFlight = useRef<Promise<unknown> | null>(null);
  const onEnter = (run: () => Promise<unknown>) => {
    const start = () => {
      if (!inFlight.current) inFlight.current = run().finally(() => (inFlight.current = null));
    };
    if (d > 0) timer.current = window.setTimeout(start, d);
    else start();
  };
  const onLeave = () => {
    if (cancel && timer.current) window.clearTimeout(timer.current);
  };
  return { onEnter, onLeave };
}
```

**Master Visible (фрагмент):**

```ts
function applyMasterVisible(cards: Card[], visible: boolean, filter?: (c: Card) => boolean) {
  return cards.map((c) => (filter && !filter(c) ? c : { ...c, visible }));
}
```

---

## 18) Анти-паттерны (не допускать)

- Сборка LV/RU из UI/порядка ответа LLM — **только** из Manifest/SID.
- Async-состояния компонентов, влияющие на порядок — переносить в FSM/hooks.
- Запросы подсказок до истечения `showDelayMs` — запрещено; используем
  `request.strategy="afterDelay"`.
- Сырые строки UI вне i18n; шрифты/размеры/цвета — не в коде, а в конфиге/темах.
- Падение в консоль без баннера пользователю.

---

## 19) Соответствие планам релизов

- **plan_1.md (MVP):** §4, §5, §6, §7.
- **plan_2.md (v1.1):** контекстное меню, JSONL, Restore/Undo, reveal-on-peek.
- **plan_3.md (v1.2):** Ingestion (PDF/OCR/Images/Subtitles).
- **plan_4.md (v1.3):** Media follow-highlight, экспорт Anki/Quizlet.
- **plan_5.md (v2.0):** Профили/подписки/локальный NLP/YouTube.

---

## 20) Быстрые ссылки

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Планы: `doc/plan/plan_1.md … plan_5.md`
- Best-Practices: `doc/best_practices/*` (в т.ч. `tool-use.md`,
  `TechnicalGuidesForClaudeAPIv2.0.md`)
- README: `README.md`

> Любые расхождения между кодом и документами фиксируй в PR и прикладывай предложенную правку
> соответствующего документа.
