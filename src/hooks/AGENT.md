# Hooks Agent Guide — `src/hooks`

> Руководство для ИИ‑агентов и разработчиков по созданию и использованию React‑хуков в проекте
> **flashcards‑v3**. Цель — обеспечить детерминированность пайплайна, отсутствие гонок, конфиг‑first
> и прозрачный UX ошибок согласно TRS.

## 0) Канон ссылок

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Plans: `doc/plan/plan_1.md … plan_5.md`
- Best Practices: `doc/best_practices/*` (приоритет `TechnicalGuidesForClaudeAPIv2.0.md`)
- Общие правила: `AGENT.md`, UI/UX: `Codex.md`, компоненты: `src/components/AGENT.md`

---

## 1) Базовые принципы хуков

### Задачи хуков

- **Инкапсуляция бизнес-логики** FSM и агрегации.
- **Мост между утилитами и компонентами**: адаптация pure-функций (из utils/stores) к
  React-паттернам (state/effects).
- **Управление async-операциями** с корректной обработкой ошибок и сигналами отмены.

### Требования к реализации

- **Строго типизированный вход/выход** (TS + Zod на внешних границах).

- **Покрытие юнит-тестами критических ветвей** (включая ошибки/таймауты/отмены).

- **Единая обработка ошибок** (нормализация → баннеры/i18n), без «поглощения».

- **Корректный cleanup**: abort/cancel в `useEffect` cleanup, отписка слушателей/таймеров.

- **Чистая архитектура**: хук = инкапсуляция бизнес‑логики и эффектов; компоненты остаются
  «тонкими».

- **Без гонок**: любой сетевой хук обязан поддерживать отмену (`AbortController`) и
  **single‑flight** для одинаковых запросов.

- **Config‑first**: никакие значения (тайминги, лимиты, URL, хоткеи) не хардкодятся — берём из
  `/config/*.json(.*)` через `useConfig()`.

- **i18n/темы**: строки и лейблы не шьём в хуки; только ключи/флаги и возвращение статусов для UI.

- **Валидированные границы**: парсим и валидируем все внешние DTO через Zod‑схемы до возврата
  наверх.

- **Правила хуков React**: не вызывать условно, не менять порядок; эффекты — с корректными
  зависимостями.

---

## 2) Набор каноничных хуков (контракты)

### 2.1 `useConfig()`

Возвращает слитый и провалидированный конфиг приложения (кешируется в контексте).

- Источник: `/config/*.json` + Zod‑схемы.
- При ошибке валидации — бросок исключения (ловится ErrorBoundary) + баннер.

### 2.2 `useHealth()`

Pre‑flight проверка прокси и внешней сети перед любой операцией.

- `const { status, check, lastError } = useHealth();`
- `status`: `idle | checking | ok | down`.
- `check()` дергает `/api/health` с таймаутом из `config/network.json`.
- При `down` — триггерит глобальный баннер ошибок (через `useErrorBanners()`).

### 2.3 `useBatch()` (создание/статус/результаты)

Инкапсулирует batch‑оркестрацию и FSM. **Решающее место для backoff/jitter и Retry‑After.**

```ts
interface UseBatchState {
  fsm: 'idle' | 'submitted' | 'in_progress' | 'ready' | 'failed';
  create: (payload: BatchCreate) => Promise<{ batchId: string }>;
  pollStatus: (batchId: string) => Promise<BatchStatus>;
  fetchResult: (batchId: string) => Promise<BatchResult>;
  error?: BatchError;
}
```

Правила:

- При `create` и `pollStatus` **уважать** `Retry-After`; при отсутствии — применять **адаптивный
  polling** (1–2s → 3–5s → 10–30s → 30–60s) с jitter, как в TRS.
- Коды `429/413/500/529` — нормализовать в `BatchError` (локализуемые сообщения + советы). 429/529 →
  backoff c jitter; 413 → резкий отказ + подсказка сократить/изменить размер.
- Хранить последнее известное состояние в сторе, чтобы UI не опрашивал сеть чаще, чем нужно.
- Вести историю `batchId` (с метками `expired` ≥ 29 дней) — отдавать селектор в `useBatchHistory()`.

### 2.4 `useBatchHistory()`

- CRUD для локальной истории `batch_id` (добавление при успешном create, отметка просрочки по дате
  создания).
- Селектор для списка в UI + действия «загрузить», «удалить».

### 2.5 `useTooltipController()` (Reading)

Контролирует подсказки (tooltips) с задержками/отменой/единственным полётом.

```ts
interface TooltipController {
  onEnter: (anchor: HTMLElement, req: () => Promise<any>) => void;
  onLeave: () => void;
  cancelAll: () => void;
}
```

Поведение:

- Брать `showDelayMs`, `debounceMs`, `cancelOnLeave` из `config/reading.json`.
- Если `request.strategy === 'afterDelay'`, до истечения `showDelayMs` **не запускать** запросов.
- Поддерживать **single‑flight** (не более одного запроса одновременно). При новом входе —
  предыдущий отменяется.

### 2.6 `useReadingHints()`

- Разрешает конфликт слов и фраз: при пересечении выигрывает **фраза**.
- Возвращает структуру для рендера легенды и классов подсветки (из конфига).

### 2.7 `useVisibilityPolicy()`

Поддержка `all-visible` (дефолт) и `reveal-on-peek`.

- На событие «подсказка показана» → `visible=true` и отметка `peeked=true`.
- Экспорт/импорт персистит `visible/peeked`; ручные правки в Edit имеют приоритет.

### 2.8 `useDeckNav()`/`useCardActions()` (Flashcards)

- Предоставляют действия `next/prev/flip/hide` (hotkeys берём из конфига `flashcards.keybinds`).
- Гарантируют, что при переходе карточка отображает **front** сперва.

### 2.9 `useHotkeys()`

- Регистрирует хоткеи из конфигов; активен только при фокусе соответствующего контейнера;
  освобождает слушатели при unmount.

### 2.10 `useImportExport()`

- **Export JSON**: сериализация полного состояния (правки, видимость, метаданные
  `appVersion/schemaVersion/exportedAt/locale/targetLanguage`).
- **Import JSON**: diff‑превью + стратегии `replace-all | merge-keep-local | merge-prefer-imported`
  (дефолт из `io.import.defaultMerge`).
- **Import JSONL** (v1.1): потоковый парсер (строка→JSON), агрегация по `custom_id==SID`. Отчёт по
  ошибкам строк.

### 2.11 `useRestore()`

- Создаёт бэкап входного состояния «после первичной обработки».
- `restore()` откатывает все ручные правки/добавления/удаления; в `reveal-on-peek` — сбрасывает
  `visible/peeked`.
- Опциональный `undo()` в окне N минут (из конфигов).

### 2.12 `useErrorBanners()`

- Унифицированный диспетчер баннеров (ошибки/инфо) с i18n ключами.
- Маппит коды `429/413/500/529` + down proxy/network + expired batch на локализованные подсказки.

### 2.13 `useMediaAnchors()` (v1.3)

- Работает с `{sid,start,end}`; отдаёт «текущий SID» по `currentTime()` плеера и функции перехода к
  сегменту (с pre/post‑roll из `media.json`).

---

## 3) Сетевые паттерны: backoff, Retry‑After, cancel, single‑flight

### 3.1 Backoff с jitter (пример)

```ts
export function expBackoff(attempt: number, baseMs: number, maxMs: number) {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = Math.random() * 0.4 * exp; // +/-40%
  return Math.max(100, exp - jitter);
}
```

### 3.2 Уважение `Retry‑After`

```ts
function parseRetryAfter(h: string | undefined) {
  if (!h) return null;
  const sec = Number(h);
  if (Number.isFinite(sec)) return sec * 1000;
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}
```

### 3.3 Отмена запросов и единственный полёт

```ts
export function singleFlight<T>(key: string, fn: () => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  return () => {
    if (cache.has(key)) return cache.get(key)!;
    const p = fn().finally(() => cache.delete(key));
    cache.set(key, p);
    return p;
  };
}

export async function fetchWithCancel(url: string, opts: RequestInit & { signal?: AbortSignal }) {
  const ctl = new AbortController();
  const signal = opts.signal ?? ctl.signal;
  const res = await fetch(url, { ...opts, signal });
  return { res, cancel: () => ctl.abort() };
}
```

---

## 4) Конфиги и без‑хардкодов

- Тайминги polling/задержек/анимаций/лимитов/размеров/ хоткеев/цветов/шрифтов — **только** из
  конфигов.
- Имя модели/endpoint/базовый URL — из конфигов (`llm.json`, `network.json`).
- Ключи i18n — централизованно в `/src/locales/*`.

---

## 5) Тестирование хуков

- **Unit**: msw для HTTP, jest fake timers для delay/debounce/backoff; проверять отмену и
  single‑flight.
- **Property‑based**: корректность агрегации по SID, инварианты FSM, устойчивость к перемешанным
  JSONL строкам.
- **Integration/RTL**: хук + тестовый компонент; сценарии ошибок сети/прокси; баннеры отображаются
  немедленно.
- **E2E (Cypress)**: счастливые пути и негативные кейсы (429/413/500/529, expired batch, down proxy,
  нет сети).

---

## 6) Производительность

- Дебаунсы и троттлы из конфигов; минимизировать перечерчивания через селекторы/мемоизацию.
- Для больших коллекций — не возвращать «сырые» массивы без мемо‑срезов.
- В Reading — **single‑flight** и `request.strategy='afterDelay'` для снятия нагрузки.

---

## 7) Примеры

### 7.1 `useHealth` (скелет)

```ts
export function useHealth() {
  const cfg = useConfig();
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'down'>('idle');
  const [lastError, setLastError] = useState<Error | undefined>();
  const check = useCallback(async () => {
    setStatus('checking');
    try {
      const ac = new AbortController();
      const res = await fetch(cfg.network.healthUrl || '/api/health', {
        signal: ac.signal,
        method: 'GET',
      });
      if (!res.ok) throw new Error('HEALTH_BAD_STATUS');
      setStatus('ok');
    } catch (e) {
      setLastError(e as Error);
      setStatus('down');
    }
  }, [cfg.network.healthUrl]);
  return { status, check, lastError };
}
```

### 7.2 `useTooltipController` (с задержкой и single‑flight)

```ts
export function useTooltipController(): TooltipController {
  const { tooltip } = useConfig().reading;
  const timer = useRef<number | undefined>();
  const inFlight = useRef<Promise<any> | null>(null);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  };
  const onEnter = (_anchor: HTMLElement, req: () => Promise<any>) => {
    const start = () => {
      if (!inFlight.current) inFlight.current = req().finally(() => (inFlight.current = null));
    };
    if (tooltip.showDelayMs > 0) {
      timer.current = window.setTimeout(start, tooltip.showDelayMs);
    } else start();
  };
  const onLeave = () => {
    if (tooltip.cancelOnLeave) cancel();
  };
  return { onEnter, onLeave, cancelAll: cancel };
}
```

### 7.3 `useBatch` (фрагмент polling)

```ts
const schedule = [1500, 3000, 12000, 45000]; // пример: заменить на значения из конфига
export function useBatch(): UseBatchState {
  const cfg = useConfig();
  const [fsm, setFsm] = useState<'idle' | 'submitted' | 'in_progress' | 'ready' | 'failed'>('idle');
  const pollStatus = useCallback(
    async (id: string) => {
      setFsm('in_progress');
      let attempt = 0;
      while (true) {
        const r = await fetch(`/api/batch/status?id=${id}`);
        if (!r.ok) {
          /* нормализовать ошибку */
        }
        const retryAfter = parseRetryAfter(r.headers.get('Retry-After'));
        const body = await r.json();
        if (body.state === 'ready' || body.state === 'failed') {
          setFsm(body.state);
          return body;
        }
        const base = schedule[Math.min(attempt, schedule.length - 1)];
        const wait = retryAfter ?? expBackoff(attempt++, base, cfg.batch.maxPollIntervalMs);
        await new Promise((res) => setTimeout(res, wait));
      }
    },
    [cfg.batch.maxPollIntervalMs],
  );
  return {
    fsm,
    create: async () => {
      /*...*/
    },
    pollStatus,
    fetchResult: async () => {
      /*...*/
    },
  };
}
```

---

## 8) Чек‑лист перед PR

- [ ] Нет хардкодов; все значения читаются из `useConfig()`.
- [ ] Поддерживаются отмена запросов и **single‑flight**; отсутствуют гонки.
- [ ] Учитывается `Retry‑After`; backoff с jitter реализован.
- [ ] Коды `429/413/500/529` нормализуются и приводят к баннерам.
- [ ] В `reveal-on-peek` события подсказок корректно меняют видимость карточек.
- [ ] Хуки протестированы (unit/RTL/E2E); фейковые таймеры покрывают задержки/дебаунсы.
- [ ] Ссылки на разделы TRS/plan добавлены в PR.
