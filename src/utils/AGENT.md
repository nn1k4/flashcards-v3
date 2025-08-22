# Utils Agent Guide — `src/utils` (v5.1)

> Цель файла: зафиксировать правила и контракты для **чистых, детерминированных** утилит
> манифест-архитектуры. Всё из `utils` — **side-effect free** (без сети, DOM и глобальных мутаций),
> с **строго типизированными** интерфейсами и стабильным поведением.

- Канон ссылок: TRS `doc/trs/trs_v_5.md`, Roadmap, Plans (`plan_1..5.md`), Best Practices
  (`TechnicalGuidesForClaudeAPIv2.0.md`, `tool-use.md`), общие правила: `AGENT.md`, `Codex.md`.

---

## 0) Инварианты `utils` (не нарушать)

- **Pure-функции.** Никаких побочных эффектов, таймеров, случайных чисел (кроме явно инъектируемых
  зависимостей).
- **Deterministic сплит/сборка.** Одинаковый вход + одинаковые параметры ⇒ одинаковый результат.
- **Idempotent manifest.** Повторный `buildManifest` с теми же зависимостями выдаёт тот же манифест.
- **Manifest-first / SID-centric.** Порядок LV и сборка RU/target определяются **только** по SID из
  манифеста; порядок JSONL/ответов LLM игнорируется.
- **JSON-only.** Любые внешние структуры валидируются Zod-схемами; гибриды (текст+JSON) запрещены.
- **Config-agnostic.** Утилиты **не читают** конфиги сами — всё, что нужно, приходит аргументами.
- **i18n-нейтральность.** Возвращаем коды/структуры, не тексты локализации.
- **TS strict + exactOptionalPropertyTypes.** В опциональные поля не записывается `undefined`.

---

## 1) Карта модулей и контракты

### 1.1 `manifest.ts` — построение/валидация манифеста

```ts
export interface ManifestItem {
  sid: number;
  lv: string;
  sig: string;
}
export interface Manifest {
  items: ManifestItem[];
  meta?: Record<string, unknown>;
}

export type SentenceSplitter = (text: string) => string[];
export type SigFn = (lvNormalized: string, sid: number) => string;

export interface SidStrategy {
  kind: 'sequential' | 'custom';
  next(i: number, span?: { start?: number; end?: number }): number;
}

export function buildManifest(
  text: string,
  split: SentenceSplitter,
  mkSig: SigFn,
  sidStrategy?: SidStrategy, // по умолчанию sequential 0..N-1
): Manifest;

export function normalizeLvForSig(s: string): string; // Unicode NFKC + trim + collapse WS
export function defaultSig(lvNorm: string, sid: number): string; // base64(`${lvNorm}#${sid}`)
export function assertManifest(m: Manifest): void; // throws при нарушении инвариантов
```

**Правила:** `sid` по умолчанию — 0..N-1; `sig` = функция от **нормализованного** LV и `sid`.
Валидация: монотонность `sid`, уникальные `sig`, `lv` не пустые.

---

### 1.2 `aggregator.ts` — агрегация по SID

```ts
export interface JsonlLine {
  [k: string]: unknown;
}
export interface SidKeyCfg {
  sidKey?: string /* default 'custom_id' */;
}

export interface RuUnit {
  text: string;
  meta?: Record<string, unknown>;
}
export interface CardAggregate {
  sid: number;
  base?: string;
  ru?: RuUnit;
  ctx: RuUnit[];
}

export function parseJsonl(text: string): JsonlLine[]; // «строка→JSON», падает на 100% битом файле
export function safeParseJsonl(text: string): {
  ok: JsonlLine[];
  bad: { line: number; error: string }[];
}; // не валится на единичных ошибках

export function aggregateBySid(lines: JsonlLine[], cfg?: SidKeyCfg): Map<number, CardAggregate>; // порядок строк игнорируется

export function pickCanonical(units: RuUnit[]): RuUnit | undefined; // стратегия «лучший» вариант
export function mergeAggregates(
  a: Map<number, CardAggregate>,
  b: Map<number, CardAggregate>,
): Map<number, CardAggregate>;
```

**Правила:** SID берём **только** из `custom_id` (или `sidKey`). Дубликаты объединяются;
`pickCanonical` может учитывать полноту текста/длину/метаданные (например, качество). Итоговая
сборка RU/target позже идёт **строго по порядку SID из манифеста**.

---

### 1.3 `fsm.ts` — чистые автоматы (batch/tooltip)

```ts
export type BatchState = 'idle' | 'submitted' | 'in_progress' | 'ready' | 'failed';
export type BatchEvent =
  | { type: 'SUBMIT' }
  | { type: 'TICK' }
  | { type: 'RESOLVE' }
  | { type: 'REJECT'; error: string };

export const BATCH_TRANSITIONS: Readonly<Record<BatchState, BatchEvent['type'][]>>;
export function batchReduce(s: BatchState, e: BatchEvent): BatchState;
export function isTerminal(s: BatchState): boolean;
```

**Правила:** таблица переходов неизменяема; недопустимые переходы не меняют состояние (или кидают
контролируемую ошибку). Функции — **pure**.

---

### 1.4 `schema.ts` — Zod-схемы DTO/структур

```ts
import { z } from 'zod';

// JSONL unit (Anthropic batches)
export const zJsonlUnit = z.object({
  custom_id: z.number(),
  result: z.unknown(), // конкретизируется под наш payload
  status: z.enum(['succeeded', 'errored', 'canceled', 'expired']).optional(),
  error: z.any().optional(),
});

// Structured output (flashcards)
export const zFormEntry = z.object({ form: z.string(), translation: z.string() });
export const zContext = z.object({
  latvian: z.string(),
  russian: z.string().optional(), // legacy read-only
  language: z.string().optional(), // target language code
  forms: z.array(zFormEntry).default([]),
  sid: z.number().optional(),
});
export const zCard = z.object({
  unit: z.enum(['word', 'phrase']),
  base_form: z.string(),
  base_translation: z.string().optional(),
  contexts: z.array(zContext).default([]),
  visible: z.boolean().default(true),
});
export const zPayloadCards = z.union([z.array(zCard), z.object({ flashcards: z.array(zCard) })]);

export type JsonlUnit = z.infer<typeof zJsonlUnit>;
export type Card = z.infer<typeof zCard>;
```

**Правила:** любой вход снаружи (JSON/JSONL/tool input) проходит через Zod до дальнейшей обработки.

---

### 1.5 `toolpayload.ts` — извлечение JSON-only из tool-use

> Модуль чисто структурный: **не знает** про сеть/SDK. Принимает уже «сырую» структуру контента
> (например, результат сериализации блока `tool_use`) и валидирует по `zPayloadCards`.

```ts
export interface ToolInput<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
export function coerceCardsPayload(input: unknown): ToolInput<{ flashcards: Card[] }>;
```

**Правила:** принимать **только** JSON-объекты/массивы; любая «обёртка текстом» → ошибка.

---

### 1.6 `textStats.ts` — статистика

```ts
export interface TextStats {
  words: number;
  chars: number;
  sentences: number;
  phrases: { unique: number; occurrences: number };
}
export function calcStats(manifest: Manifest, phraseIndex: Set<string>, locale: string): TextStats; // слова по UAX-29; chars — графемы
```

---

### 1.7 `error.ts` — нормализация ошибок

```ts
export type ErrorKind =
  | 'RATE_LIMIT'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVER'
  | 'OVERLOADED'
  | 'NETWORK'
  | 'PROXY_DOWN'
  | 'EXPIRED'
  | 'SCHEMA';
export interface NormalizedError {
  kind: ErrorKind;
  code?: number;
  detail?: string;
}

export function normalizeHttpError(code: number, detail?: string): NormalizedError;
export function normalizeNetworkError(e: unknown): NormalizedError;
export function schemaError(detail: string): NormalizedError;
```

**Маппинг по умолчанию:** `429→RATE_LIMIT`, `413→PAYLOAD_TOO_LARGE`, `500→SERVER`, `529→OVERLOADED`,
просрочка → `EXPIRED`.

---

### 1.8 `jsonl.ts` — безопасный парсер JSONL

```ts
export interface JsonlParseReport {
  ok: JsonlLine[];
  bad: { line: number; error: string }[];
}
export function safeParseJsonl(text: string): JsonlParseReport;
```

---

### 1.9 `concurrency.ts` — без сетей/DOM

```ts
export function singleFlight<T>(key: string, fn: () => Promise<T>): () => Promise<T>;
export function expBackoff(attempt: number, baseMs: number, maxMs: number): number;
export function stableStringify(x: unknown): string; // детерминированная сериализация для хешей/сигнатур
```

---

### 1.10 `positioning.ts` (опц.) — чистая геометрия

Вход — размеры/координаты якоря/viewport; выход — координаты тултипа без выхода за экран.

---

## 2) Связь с tool-use / stop-reasons / caching

- `utils` **не вызывают** LLM и **не знают** о кэше провайдера.
- Но они задают **жёсткие структуры**: `zPayloadCards`, `coerceCardsPayload`, `zJsonlUnit`. Это
  гарантирует **JSON-only** трактовку и единый формат парсинга в hooks/adapters.
- Обработка `stop_reason: "max_tokens"` живёт в hooks/оркестраторе; в `utils` только схемы/парсеры.

---

## 3) Примеры (сокращённо)

### 3.1 Нормализация и сигнатура

```ts
export function normalizeLvForSig(s: string) {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim();
}
export function defaultSig(lvNorm: string, sid: number) {
  return Buffer.from(`${lvNorm}#${sid}`, 'utf8').toString('base64');
}
```

### 3.2 Агрегация по SID

```ts
export function aggregateBySid(lines: JsonlLine[], cfg: SidKeyCfg = {}) {
  const sidKey = cfg.sidKey ?? 'custom_id';
  const acc = new Map<number, CardAggregate>();
  for (const line of lines) {
    const sid = (line as any)[sidKey];
    if (typeof sid !== 'number') continue;
    const prev = acc.get(sid) ?? { sid, ctx: [] };
    // извлечение данных из line.result — по договору схем (внешний адаптер уже провалидировал)
    acc.set(sid, prev);
  }
  return acc;
}
```

### 3.3 FSM переходы

```ts
export const BATCH_TRANSITIONS = {
  idle: ['SUBMIT'],
  submitted: ['TICK', 'RESOLVE', 'REJECT'],
  in_progress: ['TICK', 'RESOLVE', 'REJECT'],
  ready: [],
  failed: [],
} as const;
export function batchReduce(s: BatchState, e: BatchEvent): BatchState {
  const allowed = BATCH_TRANSITIONS[s];
  if (!allowed.includes(e.type as any)) return s;
  if (e.type === 'SUBMIT') return 'submitted';
  if (e.type === 'TICK') return s === 'submitted' ? 'in_progress' : s;
  if (e.type === 'RESOLVE') return 'ready';
  if (e.type === 'REJECT') return 'failed';
  return s;
}
```

---

## 4) Тест-стратегия

- **Golden:** порядок предложений из манифеста всегда совпадает при сборке, агрегация по SID не
  зависит от перестановок JSONL.
- **Property-based:** перестановки/дубликаты/пропуски SID → корректная каноникализация; FSM без
  нелегальных переходов.
- **Unit:** `manifest/aggregator/fsm/schema/jsonl/error/textStats/concurrency`.
- **Coverage:** критические ветки и ошибки схем покрыты.

---

## 5) Безопасность / приватность

- Никаких логов с сырыми текстами/ключами/ответами моделей. Для диагностики — короткий `detail` без
  PII.
- Любой «внешний» объект сначала проходит через Zod-схему; при провале — **контролируемая** ошибка
  `SCHEMA`.

---

## 6) Чек-лист перед PR

- [ ] Функции **pure**, без сети/DOM/глобальных состояний.
- [ ] Порядок/агрегация опираются **только** на Manifest/SID; JSONL порядок игнорируется.
- [ ] Все внешние структуры валидируются Zod-схемами; опции не получают `undefined`.
- [ ] Нет хардкодов конфигов; все параметры передаются аргументами.
- [ ] Ошибки нормализуются (`error.ts`), без утечки чувствительных данных.
- [ ] Тесты: golden/property-based/unit присутствуют/обновлены, покрывают ошибки/границы.
- [ ] Ссылки на соответствующие пункты TRS/планов указаны в описании PR.
