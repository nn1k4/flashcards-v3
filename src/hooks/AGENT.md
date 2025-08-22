# Hooks Agent Guide — `src/hooks` (v5.1)

> Руководство для ИИ-агентов и разработчиков по созданию и использованию React-хуков в
> **flashcards-v3**. Цель — **детерминированный пайплайн**, отсутствие гонок, **config-first**,
> предсказуемые баннеры ошибок и поддержка **tool-use**/batch-флоу согласно TRS/планам.

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Plans: `doc/plan/plan_1.md … plan_5.md`
- Best Practices: `doc/best_practices/*` (приоритет: `TechnicalGuidesForClaudeAPIv2.0.md`,
  `tool-use.md`)
- Общие правила: `AGENT.md`, UI/UX: `Codex.md`, компоненты: `src/components/AGENT.md`, утилиты:
  `src/utils/AGENT.md`

---

## 0) Инварианты для хуков

- **Manifest/SID — источник истины.** Любая агрегация/сборка идёт **по SID**, порядок прихода данных
  не важен.
- **FSM-first.** Хуки управляют процессами через конечные автоматы; никаких «спонтанных» setState.
- **JSON-only через tools.** Хуки принимают структурированный `tool_use.input` (уже
  провалидированный адаптером), различают **stop reasons** и ошибки HTTP.
- **Config-first.** Тайминги, лимиты, хоткеи, URL — только из `/config/*.json(.*)` через
  `useConfig()`.
- **Без гонок.** Отмена (`AbortController`), **single-flight**, дедупликация повторных запросов.
- **Ошибки — в баннеры.** Нормализованные ошибки и статусы выдаются в UI сразу.

---

## 1) Задача хуков

- Инкапсулировать бизнес-логику (FSM, агрегация, backoff, поллинги, политики видимости).
- Соединять **чистые утилиты/stores** с компонентами (адаптация под React: state/effects).
- Управлять сетью/таймерами/отменой и не допускать утечек (cleanup).

---

## 2) Каноничные хуки и контракты

### 2.1 `useConfig()`

Возвращает слитый и **провалидированный** конфиг (кэш/контекст). Ошибки валидации — в
ErrorBoundary + баннер.

### 2.2 `useHealth()`

Pre-flight для `/api/health` перед **single**/**batch**.

```ts
type Health = 'idle' | 'checking' | 'ok' | 'down';
function useHealth(): { status: Health; check(): Promise<void>; lastError?: Error };
```

— таймауты/URL из `network.json`; при `down` → глобальный баннер.

### 2.3 `useBatch()` — create/status/result + FSM

Оркестрация Message Batches: backoff + jitter, уважение `Retry-After`, история `batchId`.

```ts
type BatchFsm = 'idle' | 'submitted' | 'in_progress' | 'ready' | 'failed';
interface UseBatch {
  fsm: BatchFsm;
  create(payload: BatchCreate): Promise<{ batchId: string }>;
  pollStatus(batchId: string): Promise<BatchStatus>;
  fetchResult(batchId: string): Promise<BatchResult>;
  error?: BatchError;
}
```

Правила:

- 429/529 → экспоненциальный backoff (+jitter) и honor `Retry-After`.
- 413 → немедленный отказ с советом (лимит конфигом).
- История ID (с меткой **expired** ≥ 29 дней) — через `useBatchHistory()`.

### 2.4 `useBatchHistory()`

CRUD истории `batch_id` (add/markExpired/remove/list). В UI: список + «Загрузить/Удалить».

### 2.5 `useLLMToolsEmitter()` — single-вызовы через tools

Хук поверх адаптера LLM, **понимает tool-use** и **stop reasons**:

```ts
interface ToolCallResult<T> {
  ok: boolean;
  data?: T; // tool_use.input после Zod-валидации
  stopReason?: 'max_tokens' | 'tool_use' | 'end_turn' | 'unknown';
  error?: NormalizedError; // HTTP/схемы/сети
}
function useLLMToolsEmitter<TSchema>(): {
  invoke(input: PromptInput): Promise<ToolCallResult<TSchema>>;
};
```

Политика:

- `stop_reason: "max_tokens"` → вернуть `ok=false`, `stopReason="max_tokens"`, чтобы UI мог
  предложить **retry**; для батчей — делегировать split-retry в `useBatch()`/оркестратор.

### 2.6 `useTooltipController()` (Reading)

Контролирует задержку/отмену/единственный полёт и **visibility-event** для `reveal-on-peek`.

```ts
interface TooltipController {
  onEnter(anchor: HTMLElement, req: () => Promise<void>): void; // запускается после delay
  onLeave(): void;
  cancelAll(): void;
}
```

Правила:

- До `showDelayMs` **не** выполнять запрос (если `request.strategy="afterDelay"`).
- Один in-flight; новый вход отменяет старый.
- На успешный показ → эмит «peeked/visible» (через `useVisibilityPolicy()`).

### 2.7 `useReadingHints()`

Разрешение пересечений «слово/фраза» (выигрывает **фраза**), отдаёт классы/легенду из конфига.

### 2.8 `useVisibilityPolicy()`

Поддержка `all-visible`/`reveal-on-peek`. Событие **подсказка показана** → `visible=true`,
`peeked=true`. Персист/экспорт значений; при ручных правках в Edit — приоритет за Edit.

### 2.9 `useDeckNav()` / `useCardActions()` (Flashcards)

Навигация и действия `next/prev/flip/hide`. Гарантия: при переходе → **front**.

### 2.10 `useHotkeys()`

Регистрация хоткеев из конфигов; активность по фокусу контейнера; корректный cleanup.

### 2.11 `useImportExport()`

- **Export JSON**: полный снапшот (правки, видимость,
  `appVersion/schemaVersion/exportedAt/locale/targetLanguage`).
- **Import JSON**: diff-превью + стратегии `replace-all | merge-keep-local | merge-prefer-imported`
  (дефолт из `io.import.defaultMerge`).
- **Import JSONL** (v1.1): потоковый парсер, `custom_id==SID`, агрегация, отчёт
  imported/skipped/invalid.

### 2.12 `useRestore()`

Откат к входному состоянию после первичной обработки; опц. `Undo` (TTL из конфигов). В
`reveal-on-peek` сбрасывает `visible/peeked`.

### 2.13 `useErrorBanners()`

Единый диспетчер баннеров (i18n-ключи), маппинг кодов 429/413/500/529, сети/прокси/expired, а также
**stop_reason: "max_tokens"** (совет «Повторить»/split-retry).

### 2.14 `useContextMenuActions()` (v1.1)

Сборка пунктов контекстного меню Reading: плейсхолдеры `%w/%p/%b/%s/%sel/%lv/%tl`, URI-кодирование,
белый список доменов.

### 2.15 `useMediaAnchors()` (v1.3)

Работа с `{sid,start,end}`; вычисляет активный SID по `currentTime()` плеера; `playSegment(SID)`
учитывает pre/post-roll из `media.json`.

---

## 3) Сетевые паттерны

### 3.1 Backoff + jitter

```ts
export function expBackoff(attempt: number, baseMs: number, maxMs: number) {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  const jitter = Math.random() * 0.4 * exp;
  return Math.max(100, exp - jitter);
}
```

### 3.2 Honor `Retry-After`

```ts
export function parseRetryAfter(h?: string | null) {
  if (!h) return null;
  const sec = Number(h);
  if (Number.isFinite(sec)) return sec * 1000;
  const dt = Date.parse(h);
  return Number.isFinite(dt) ? Math.max(0, dt - Date.now()) : null;
}
```

### 3.3 Cancel + single-flight

- Каждый сетевой хук — с `AbortController`.
- Дубликаты запросов — через **single-flight** на ключ (например, SID).

---

## 4) Tool-use / stop-reasons (важно)

- Single-вызовы: `useLLMToolsEmitter()` возвращает **`tool_use.input`** (после Zod-валидации) или
  `stopReason`.
- Batch: парсинг JSONL → маппинг по `custom_id==SID`; для `stop_reason: "max_tokens"` **не** валить
  весь батч — UI показывает баннер и предлагает **retry/split-retry** для проблемного чанка.
- **Prompt caching**: стабилизируем system/tools на стороне адаптера; хук не должен шуметь конфигами
  в запросах (избегать лишних вариаций параметров).

---

## 5) Конфиги и анти-хардкод

- Тайминги (tooltip/polling), лимиты (chunk sizes, maxFileSizeMB), хоткеи, URL, имена моделей —
  **только** из конфигов (`useConfig()`); линт «анти-хардкод» обязателен.
- Строки — через i18n; темы из токенов.

---

## 6) Тестирование хуков

- **Unit:** msw для HTTP; fake timers для delay/debounce/backoff; проверять отмену и single-flight.
- **Property-based:** инварианты агрегации по SID, устойчивость к перестановке JSONL строк,
  корректность FSM переходов.
- **Integration/RTL:** тестовый компонент + хук; баннеры при 429/413/500/529/expired/down-proxy.
- **E2E (Cypress):** счастливые и негативные пути (health-down, сети нет, expired batch,
  reveal-on-peek, контекстное меню).

---

## 7) Производительность

- В Reading — `request.strategy="afterDelay"`, debounce, single-flight; отмена на `mouseleave`.
- Мемо-срезы/селекторы; не возвращать огромные неизолированные массивы из хука.
- Ленивая подгрузка тяжёлых частей (JSONL parser, media).

---

## 8) Примеры

### 8.1 `useTooltipController` (delay + single-flight)

```ts
export function useTooltipController(): TooltipController {
  const { tooltip } = useConfig().reading;
  const timer = useRef<number | undefined>();
  const inFlight = useRef<Promise<any> | null>(null);

  const cancelAll = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  };
  const onEnter = (_anchor: HTMLElement, req: () => Promise<any>) => {
    const start = () => {
      if (!inFlight.current) inFlight.current = req().finally(() => (inFlight.current = null));
    };
    if (tooltip.showDelayMs > 0 && tooltip.request?.strategy === 'afterDelay')
      timer.current = window.setTimeout(start, tooltip.showDelayMs);
    else start();
  };
  const onLeave = () => {
    if (tooltip.cancelOnLeave) cancelAll();
  };
  return { onEnter, onLeave, cancelAll };
}
```

### 8.2 Фрагмент polling в `useBatch`

```ts
export function useBatch(): UseBatch {
  const cfg = useConfig();
  const [fsm, setFsm] = useState<BatchFsm>('idle');

  const pollStatus = useCallback(
    async (id: string) => {
      setFsm('in_progress');
      let attempt = 0;
      while (true) {
        const r = await fetch(`/api/batch/status?id=${id}`);
        if (!r.ok) {
          /* normalize → throw/return error for banner */
        }
        const retryAfter = parseRetryAfter(r.headers.get('Retry-After'));
        const body: BatchStatus = await r.json();
        if (body.state === 'ready' || body.state === 'failed') {
          setFsm(body.state);
          return body;
        }
        const base =
          cfg.batch.pollScheduleMs?.[Math.min(attempt, cfg.batch.pollScheduleMs.length - 1)] ??
          1500;
        const wait = retryAfter ?? expBackoff(attempt++, base, cfg.batch.maxPollIntervalMs);
        await new Promise((res) => setTimeout(res, wait));
      }
    },
    [cfg.batch],
  );

  return {
    fsm,
    create: async () => {
      /* … */
    },
    pollStatus,
    fetchResult: async () => {
      /* … */
    },
  };
}
```

### 8.3 Обработка `max_tokens` в single-вызове

```ts
const { invoke } = useLLMToolsEmitter<MySchema>();
const r = await invoke(prompt);
if (!r.ok && r.stopReason === 'max_tokens') {
  // отдать в UI сигнал для "Повторить"/повысить лимит; не считать это HTTP-ошибкой
}
```

---

## 9) Чек-лист перед PR

- [ ] Нет хардкодов; все значения берутся из `useConfig()`.
- [ ] Поддерживаются **отмена** и **single-flight**; отсутствуют гонки.
- [ ] Honor `Retry-After`, backoff + jitter реализованы.
- [ ] Коды 429/413/500/529 и **expired** маппятся в баннеры; down-proxy/нет сети — немедленные
      баннеры.
- [ ] Поддержаны **tool-use** и **stop reasons** (особенно `max_tokens`).
- [ ] `reveal-on-peek`: событие подсказки корректно меняет `visible/peeked`.
- [ ] Unit/RTL/E2E тесты обновлены; fake timers покрывают delay/debounce/backoff.
- [ ] Ссылки на §§ TRS/plan добавлены в PR; изменения согласованы с `src/components/AGENT.md`.

---
