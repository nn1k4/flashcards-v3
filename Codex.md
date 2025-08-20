# Flashcards‑v3 — Code & UX Codex

> **Назначение:** каноничные правила реализации UI/UX, структурирования кода и качества для этого
> репозитория. Документ комплементарен **AGENT.md** и отслеживает требования из **TRS** и планов
> релизов.

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Plans: `doc/plan/plan_1.md … plan_5.md`
- Best Practices: `doc/best_practices/*` (приоритетный — `TechnicalGuidesForClaudeAPIv2.0.md`)

---

## 0) Золотые правила

1. **Manifest/SID — источник истины.** Порядок/состав текста — только из манифеста; сборка
   перевода/контекстов детерминирована.
2. **JSON‑only из LLM.** Гибридный вывод запрещён (если не указано иное в плане).
3. **Config‑first.** Никаких магических чисел: модели, тайминги, лимиты, хоткеи, стили, размеры,
   локали — из `/config/*.json(.*)`; валидация Zod/JSON‑Schema.
4. **i18n/Theming.** Все строки в `/src/locales/*`; темы через дизайн‑токены (Tailwind/CSS vars),
   `light|dark|system`.
5. **Доступность.** Управление с клавиатуры, aria‑метки, контраст, фокус‑кольца.
6. **Ошибки пользователю — сразу.** Баннеры в UI не заменяются логами в консоли.
7. **Node 24.6.0 (ESM) + npm 11.5.1.** Линт‑вывод через `eslint-formatter-codeframe`.

---

## 1) Архитектура фронтенда

**Stack:** React 18 + TypeScript + Vite + Tailwind + Framer Motion + Cypress. **Организация кода
(`src/`)**

```
components/  # dumb/feature components (index.ts barrel per feature)
  Flashcards/
  Reading/
  Translation/
  Edit/
  ImportExport/
  Banners/
  Media/          # v1.3
hooks/        # useX hooks; максимум один домен на файл
stores/       # cardStore, contextStore, uiStore (zustand/reducer)
utils/        # manifest.ts, aggregator.ts, fsm.ts, textStats.ts, tooltip.ts
api/          # client.ts (HTTP), schema.ts (Zod DTO)
locales/      # ru.json, uk.json, en.json, ...
styles/       # tokens.css, tailwind directives, reset
```

**Принципы:**

- Компоненты чистые; бизнес‑логика в hooks/stores.
- Паблик API фичи — `index.ts` в папке фичи.
- Разбивка по фичам (feature‑first), а не по слоям.
- Внешние эффекты (HTTP/таймеры) — только в hooks, с отменой и idempotency.

---

## 2) Состояние и события

- **Stores**: `CardStore`, `ContextStore`, `UiStore`; события: `CARD_UPDATED`, `CONTEXT_UPDATED`,
  `CARD_VISIBILITY_CHANGED`, `IMPORT_APPLIED`, `RESTORE_APPLIED`, `BATCH_STATUS_CHANGED`.
- **FSM**: чёткая машина для batch‑процесса и для tooltip controller. Переходы детерминированы; no
  implicit setState.
- **Мемоизация:** селекторы и вычисляемые поля мемоизируются (RSC‑совместимо в будущем).

---

## 3) UI режимов (MVP)

### 3.1 Text

- Поле ввода (лимит из конфигов), кнопка **Очистить**.
- Переключатель **Использовать пакетную обработку** →
  - меняет лейбл кнопки на «Начать пакетную обработку»;
  - показывает форму «Получить результаты batch» (input `batch_id`, кнопка Загрузить, история
    `batch_id` с меткой **просрочено** ≥ 29 дней).

- Перед стартом/загрузкой — **pre‑flight `/api/health`**; при ошибке — немедленный баннер.

### 3.2 Flashcards

- **Клавиши:** `ArrowLeft/ArrowRight` навигация; `Space|ArrowUp|ArrowDown` flip; `h` — скрыть
  карточку.
- Переход к другой карточке всегда открывает **front**.
- Контексты: отображать `N` по умолчанию; «Показать больше» до `M` (оба из конфигов).
- Подсветка целевой формы; LV + перевод; округлые углы, анимация flip (Framer Motion).
- **Политика видимости:** `all-visible` (дефолт) | `reveal-on-peek`. Вторая — активирует карточку
  после успешной подсказки в Reading.

### 3.3 Reading

- Различная подсветка **слов** и **фраз**; при пересечении — **фраза приоритетна**.
- Tooltip: **surface‑форма** и перевод; позиционирование с учётом viewport; мобильный
  popover/bottom‑sheet.
- Производительность: `tooltip.showDelayMs` (0/3000), `debounceMs`, `cancelOnLeave=true`,
  **single‑flight**, `request.strategy="afterDelay"` (до порога — без запросов).
- (v1.1) **Контекстное меню** (ПКМ/long‑press) из `config/actions.json` с плейсхолдерами
  `%w/%p/%b/%s/%sel/%lv/%tl` и белым списком доменов.
- (Опц.) hover‑TTS — флаг в конфиге (будущее).

### 3.4 Translation

- Панель статистики: **слова (UAX‑29)**, **символы (графемы)**, **предложения (SID)**, **фразы**
  (unique|occurrences). Все вычисления — через `Intl.Segmenter`.

### 3.5 Edit

- Таблица с пагинацией (`pageSize`), поиск по базовой форме/переводу (опц.: по контекстам).
- **VISIBLE** + **Master Visible** (все/текущий фильтр).
- Редактирование **базового перевода** и **переводов контекстов**; **мгновенная** пропагация в
  Flashcards/Reading/Translation.
- Ссылка **«править контексты (N)»** (модал/таблица).
- **Restore** (v1.1): откат к исходному результату, опционально Undo (локальный бэкап).

---

## 4) Импорт/Экспорт/Restore

- **Import JSON**: полный снапшот со всеми правками; превью diff и стратегии
  `replace-all | merge-keep-local | merge-prefer-imported` (дефолт — конфиг).
- **Import JSONL** (v1.1): потоковый парсер; агрегация по `custom_id==SID`, порядок строк не важен;
  отчёт об ошибках; «офлайн‑результат» — валиден после 29 дней.
- **Export JSON**: включает все правки + метаданные (`appVersion`, `schemaVersion`, `exportedAt`,
  `locale`, `targetLanguage`).
- **Restore**: откат ко входному состоянию; в `reveal‑on‑peek` — сброс видимости/`peeked`; Undo при
  включённом бэкапе.
- (v1.3) Экспорт **Anki/Quizlet** (CSV/TSV согласно конфигам).

---

## 5) Ошибки/Сеть/Batch UX

- **Pre‑flight `/api/health`** перед стартом/загрузкой; нет сети/прокси down → баннер **сразу**.
- **Коды:** `429`, `413`, `500`, `529`, expired batch — локализованные баннеры и советы по
  retry/backoff.
- **Polling:** адаптивно (0–10с: 1–2с; 10–60с: 3–5с; 1–10мин: 10–30с; далее: 30–60с) + jitter;
  прокси уважает `Retry‑After` при опросе Anthropic.
- **Документы приоритетов:** при расхождении гайдов следуем
  `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md`.

---

## 6) Конфиги и схемы

- Все настройки — в `/config/` + RU‑доки в `doc/configs/*.md`.
- Валидация при старте: `npm run validate:config` (Zod/JSON‑Schema).
- Генерация индекса конфигов: `npm run docs:config`.
- Линт «анти‑хардкод»: `npm run lint:anti-hardcode` (CI gate).
- Ключевые файлы: `flashcards.json`, `reading.json`, `translation.json`, `edit.json`, `io.json`,
  `batch.json`, `llm.json`, `network.json`, `i18n.json`, `theme.json` и др. (см. TRS §16).

**Анти‑паттерны (запрещено):**

- Хардкод имени модели (например, `claude-3-haiku-20240307`) — всегда через `config/llm.json`.
- Хардкод задержек/лимитов/размеров — только через конфиги.
- Сырые UI‑строки вне i18n.

---

## 7) Стили/темы/типографика

- Tailwind + CSS vars; тема `light|dark|system`.
- Базовый шрифт: **Noto Sans Display** (настройка в конфиге).
- Разные стили подсветки для **слов** и **фраз**; opacities/цвета — из конфигов.
- Tooltip/контекстное меню — не выходят за границы viewport; на мобильных — bottom‑sheet.

---

## 8) Доступность и клавиатура

- Обязательные хоткеи (Flashcards: ←/→, Space/↑/↓, `h`; Media v1.3:
  play/pause/back/forward/prev/next).
- Фокус видим; aria‑атрибуты у интерактивных элементов; достаточный контраст темы.
- Легенда подсветок в Reading; скринридер‑тексты для иконок.

---

## 9) Тестирование и качество

- **Unit:** tooltip controller (delay/cancel/single‑flight), text stats (Intl.Segmenter), reducers,
  JSONL parser/merge, import/export/restore.
- **Integration/E2E (Cypress):** happy‑path всех режимов; ошибки сети/прокси; batch‑история;
  reveal‑on‑peek; контекстное меню.
- **Golden tests:** порядок предложений сохраняется; ре‑импорт экспортированного снапшота даёт
  идентичное состояние.
- **Property‑based:** инварианты манифеста/агрегации.

**CI скрипты**

```bash
npm run lint -- --format codeframe
npm run test && npm run e2e
npm run validate:config && npm run docs:config
```

---

## 10) Сетевое взаимодействие

- **HTTP клиент** (`api/client.ts`): fetch wrapper + Zod‑валидация DTO; timeouts/retries из
  `config/network.json`.
- **LLM/Batch API**: ходим только через прокси; никаких ключей на фронте.
- **Анти‑дубликаты:** single‑flight для повторных запросов подсказок; cancelation на `mouseleave`.

---

## 11) Контекстное меню (v1.1)

- Конфиг `config/actions.json`: пункты `{id,titleKey,type,enabled,urlTemplate/payload,target}`,
  плейсхолдеры `%w/%p/%b/%s/%sel/%lv/%tl`, белый список `allowedHosts`.
- Открытие ссылок: `target="_blank"`, `rel="noopener noreferrer"`; автокодирование параметров.

---

## 12) Media (v1.3)

- `PlayerAdapter` (HTML5): `mount/play/pause/seek/currentTime/destroy`, события
  `timeupdate|ended|error`.
- `MediaAnchorsStore`: `{sid,start,end}`; follow‑highlight → Reading; pre/post‑roll из `media.json`.

---

## 13) Профили/подписки/локальный NLP (v2.0)

- Сервер: Fastify/Express + Prisma (Postgres/SQLite dev).
- Auth: JWT (HttpOnly), CSRF защита.
- Ключи провайдеров — шифрование (AES‑GCM), не возвращаются в явном виде.
- Локальный NLP/MT: `pipeline.mode = llm|local|hybrid` (см. TRS §24).

---

## 14) Git/PR процесс

- Каждый PR указывает: релиз/этап (plan_X.md), ссылки на разделы TRS, изменённые конфиги/доки.
- Чек‑лист PR (минимум):
  - [ ] Нет хардкодов; все значения — из конфигов.
  - [ ] Добавлены/обновлены Zod‑схемы и RU‑доки конфигов.
  - [ ] i18n‑ключи присутствуют; темы соблюдены.
  - [ ] Unit + E2E зелёные; golden/property‑based где нужно.
  - [ ] Баннеры ошибок в UI для всех негативных путей.
  - [ ] README/AGENT/Codex актуальны.

---

## 15) Примеры кода (сокращённо)

**Tooltip controller (основы):**

```ts
const showDelay = cfg.reading.tooltip.showDelayMs;
const deb = cfg.reading.tooltip.debounceMs;
const cancelOnLeave = cfg.reading.tooltip.cancelOnLeave;

export function useTooltipController() {
  const t = useRef<number | undefined>();
  const inFlight = useRef<Promise<any> | null>(null);
  const onEnter = (span: HTMLElement, fetcher: () => Promise<any>) => {
    if (showDelay > 0) {
      t.current = window.setTimeout(() => {
        if (!inFlight.current)
          inFlight.current = fetcher().finally(() => (inFlight.current = null));
      }, showDelay);
    } else {
      if (!inFlight.current) inFlight.current = fetcher().finally(() => (inFlight.current = null));
    }
  };
  const onLeave = () => {
    if (cancelOnLeave && t.current) window.clearTimeout(t.current);
  };
  return { onEnter, onLeave };
}
```

**Master Visible (фрагмент):**

```ts
function applyMasterVisible(
  cards: Card[],
  visible: boolean,
  onlyFiltered: boolean,
  filter: (c: Card) => boolean,
) {
  return cards.map((c) => (onlyFiltered && !filter(c) ? c : { ...c, visible }));
}
```

---

## 16) Частые ошибки и как их избегать

- Случайные сетевые «шторма» при hover → использовать `request.strategy="afterDelay"`, debounce и
  single‑flight.
- Потеря порядка предложений → никогда не собирать текст из UI; использовать манифест/SID.
- Невидимые ошибки → всегда дублировать в баннеры; консоль — только вспомогательно.
- Хардкод моделей/таймингов → конфиги + линт‑правило.

---

## A) Workflow для ChatGPT Codex

### 1. Начало работы

- ВСЕГДА начни с чтения **AGENT.md** (порядок источников, инварианты, политика конфигов).
- Изучи типы манифеста в **`@src/types/manifest.ts`** и контракты DTO в **`@src/types/dto.ts`**.
- Пойми FSM в **`@src/utils/fsm.ts`** (состояния/переходы/batch‑процесс, tooltip‑controller).

### 2. Перед любыми изменениями

- Подтверди поток данных: **Text → Manifest → LLM → DTO → Aggregation**.
- Убедись, что изменение не нарушает **manifest‑first** и не вводит хардкоды.
- Проверь совместимость с существующими DTO‑схемами (Zod) и версиями.

### 3. При добавлении функционала

- Начни с **типов** в `src/types/` и **Zod‑схем**.
- Напиши тесты **до реализации** (TDD): unit + golden/property‑based при необходимости.
- Обнови FSM, если требуются новые состояния/переходы.

---

## B) ChatGPT‑5 Thinking Prompts

### Для архитектурных изменений

```text
Проанализируй, как это изменение влияет на манифест‑ориентированную архитектуру:
1) Сохраняется ли принцип "манифест как источник истины"?
2) Не нарушаются ли инварианты SID и порядка предложений?
3) Совместимо ли с FSM переходами состояний?
4) Требуется ли обновление DTO‑схем?
```

### Для отладки проблем

```text
Используй принципы для избежания ошибок:
1) Проверь состояние FSM — где сейчас находится система?
2) Валидируй манифест — корректны ли SID и сигнатуры?
3) Проследи агрегацию по SID — правильно ли группируются данные?
4) Проверь DTO‑валидацию — соответствуют ли данные схеме?
```

### Для создания тестов

```text
Создай golden‑test, который проверяет критический инвариант:
Входной текст → (любой порядок JSONL) → агрегация по SID → сборка === исходный порядок.

Property‑based тесты для проверки:
- Перестановки JSONL‑строк не влияют на результат;
- Дубликаты/пропуски SID обрабатываются корректно;
- Все FSM‑переходы детерминированы.
```

---

## C) File References для понимания архитектуры

**Изучи в этом порядке:**

- **`@src/types/manifest.ts`** — типы манифеста и SID.
- **`@src/types/dto.ts`** — API‑контракты и Zod‑схемы.
- **`@src/utils/manifest.ts`** — создание детерминированного манифеста.
- **`@src/utils/aggregator.ts`** — агрегация результатов по SID.
- **`@src/utils/fsm.ts`** — машина состояний для UI/batch.
- **`@src/hooks/useBatch.ts`** — оркестрация batch‑обработки.
- **`@src/tests/golden/*`** — инварианты, которые нельзя нарушать.

---

## D) Специальные инструкции для манифеста/агрегации/FSM

### Манифест

- Создаётся **один раз** при инициализации.
- SID назначаются **последовательно**: `0, 1, 2, …` (числовые).
- Сигнатуры: `base64(normalized_text + "#" + sid)` (или эквивалент из `utils/manifest`).
- LV‑текст **всегда** восстанавливается как `manifest.items.map(i => i.lv)`.

### Агрегация

- Используй `Map<number, ResultData>` (ключ = SID).
- **Никогда** не опирайся на порядок прихода данных; JSONL строки могут быть в любом порядке.
- Каноникализация перевода (RU/target): `pickCanonical()` выбирает лучший вариант (правило из
  `utils/aggregator`).
- Итоговый перевод собирается по порядку SID из манифеста.

### FSM

- UI‑состояние = проекция FSM.
- Переходы: `idle → submitted → in_progress → ready | failed`.
- Запрещены прямые `setState` для состояния батча; события FSM **строго типизированы**.

---

## E) Debugging Guide для Codex

### Если нарушился порядок предложений

1. Убедись, что LV собирается из `manifest.items.map(i => i.lv)`.
2. RU/target собирается строго по порядку SID из манифеста.
3. Проверь места, где агрегация могла пойти не по SID.

### Если появились race conditions

1. Проверь, что порядок не берётся из ответов LLM.
2. Убедись, что FSM используется для всех переходов.
3. Компоненты не должны иметь отдельные async‑состояния, влияющие на порядок.

### Если падают тесты

1. Запусти golden‑тесты: `npm run test:golden`.
2. Проверь инварианты манифеста (SID, сигнатуры, порядок).
3. Убедись, что DTO‑схемы соответствуют данным.

---

## 17) Соответствие планам релизов

- **plan_1.md (MVP):** §3–§6, §9.
- **plan_2.md (v1.1):** §3.3 меню, §4 JSONL/Restore.
- **plan_3.md (v1.2):** §1.1 ingestion, связь с сегментацией.
- **plan_4.md (v1.3):** §12 Media, экспорт Anki/Quizlet.
- **plan_5.md (v2.0):** §13 профили/подписки/NLP.

---

## 18) Ссылки

- TRS/Plans/Roadmap — см. начало документа.
- Best Practices: `doc/best_practices/*` (приоритет `TechnicalGuidesForClaudeAPIv2.0.md`).
- README: корневой обзор.
