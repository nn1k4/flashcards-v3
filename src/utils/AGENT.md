# Utils Agent Guide — `src/utils`

> Цель: зафиксировать **чистые, детерминированные** утилиты для манифест‑архитектуры. Любая функция
> из `utils` должна быть **side‑effect free** (без сетевых вызовов, без доступа к DOM, без
> глобальных мутаций) и иметь **строго типизированные контракты**.

## Фокус модуля

Детерминированные утилиты **без side effects** для манифест‑ориентированной архитектуры.

---

## 1) Золотые инварианты для `utils`

- **Все функции pure**, где технически возможно.
- **Deterministic сплиттер**: одинаковый вход всегда даёт одинаковый результат (в т.ч. при
  одинаковой нормализации).
- **Идемпотентная генерация манифеста**: повторные вызовы с теми же параметрами дают тот же
  результат (при одинаковом `split` и `sigFn`).
- **Manifest‑first**: порядок/состав LV текста исходит из манифеста; утилиты **никогда** не берут
  порядок из LLM‑ответов.
- **SID‑centric**: агрегация/каноникализация строятся вокруг `SID` (числовой индекс), а не порядка
  JSONL.
- **JSON‑only**: парсинг/валидация DTO строго по схемам (Zod). Любая невалидность → контролируемая
  ошибка.
- **Config‑agnostic**: утилиты **не читают** конфиги сами; параметры приходят через аргументы
  (инъекция зависимостей).
- **i18n‑нейтральность**: утилиты возвращают коды/структуры, не локализованные тексты.

---

## 2) Каталог модулей и контракты

### 2.1 `manifest.ts`

**Назначение:** построение и валидация манифеста.

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

export interface SentenceSplitter {
  (text: string): string[];
} // инъекция сплиттера
export interface SigFn {
  (lvNormalized: string, sid: number): string;
}

export function buildManifest(text: string, split: SentenceSplitter, mkSig: SigFn): Manifest;
export function normalizeLvForSig(s: string): string; // Unicode/whitespace нормализация
export function defaultSig(lvNorm: string, sid: number): string; // base64(lvNorm + '#' + sid)
export function assertManifest(m: Manifest): void; // throws при нарушении инвариантов
```

**Правила:**

- `sid` назначаются последовательно: `0..N-1`.
- `sig` вычисляется **из нормализованного LV** и `sid`. Нормализация: trim, collapse whitespace,
  Unicode NFKC (или экв.).
- **Deterministic сплиттер** и **идемпотентность**: при одинаковых `text`, `split`, `mkSig`
  результат идентичен.
- Валидация проверяет монотонный рост `sid`, уникальность `sig`, отсутствие пустых `lv`.
- Сегментация LV делается внешним адаптером (на v1 — примитивная; позже —
  `latvian_sentence_tester`).

### 2.2 `aggregator.ts`

**Назначение:** агрегация LLM/JSONL результатов в структуры по `SID`.

```ts
export interface JsonlLine {
  [k: string]: unknown;
}
export interface SidKeyCfg {
  sidKey?: string /* default: 'custom_id' */;
}
export interface RuUnit {
  text: string;
  meta?: Record<string, unknown>;
}
export interface CardAggregate {
  sid: number;
  base: string;
  ru?: RuUnit;
  ctx: RuUnit[];
}

export function parseJsonl(text: string): JsonlLine[]; // безопасный парсинг построчно
export function aggregateBySid(lines: JsonlLine[], cfg?: SidKeyCfg): Map<number, CardAggregate>;
export function pickCanonical(units: RuUnit[]): RuUnit | undefined; // стратегия выбора
export function mergeAggregates(
  a: Map<number, CardAggregate>,
  b: Map<number, CardAggregate>,
): Map<number, CardAggregate>;
```

**Правила:**

- Извлечение `SID` только из `custom_id` (или явного `sidKey`). Порядок строк **игнорируется**.
- Дубликаты по `SID` допускаются → `pickCanonical` (например: преимущество непустых переводов,
  больший размер контекстов, доверие по модели — если поле есть).
- На выходе — Map `SID → { base, ru?, ctx[] }`. Сборка итогового перевода и карточек далее идёт
  **строго по порядку SID из манифеста**.

### 2.3 `fsm.ts`

**Назначение:** чистая машина состояний (batch/tooltip и др.).

```ts
export type BatchState = 'idle' | 'submitted' | 'in_progress' | 'ready' | 'failed';
export type BatchEvent =
  | { type: 'SUBMIT' }
  | { type: 'TICK' }
  | { type: 'RESOLVE' }
  | { type: 'REJECT'; error: string };

export function batchReduce(s: BatchState, e: BatchEvent): BatchState;
export function isTerminal(s: BatchState): boolean;
export const BATCH_TRANSITIONS: Readonly<Record<BatchState, BatchEvent['type'][]>>;
```

**Правила:**

- Таблица переходов неизменяема; любые недопустимые переходы → контролируемая ошибка (или возврат
  текущего состояния).
- Редьюсер **чистый**, без побочных эффектов.

### 2.4 `dto.ts` / `schema.ts`

**Назначение:** Zod‑схемы для внешних DTO (LLM/JSONL/HTTP) и внутренних структур.

```ts
import { z } from 'zod';
export const zJsonlUnit = z.object({ custom_id: z.number(), result: z.any() /* уточнить */ });
export const zBatchStatus = z.object({
  id: z.string(),
  state: z.enum(['queued', 'running', 'ready', 'failed']),
});
// ...другие схемы

export type JsonlUnit = z.infer<typeof zJsonlUnit>;
export type BatchStatus = z.infer<typeof zBatchStatus>;
```

**Правила:**

- Любая обработка DTO начинается с валидации схемой. При ошибке — выбрасываем **типизированную**
  ошибку (см. `error.ts`).

### 2.5 `textStats.ts`

**Назначение:** детерминированная статистика текста.

```ts
export interface TextStats {
  words: number;
  chars: number;
  sentences: number;
  phrases: { unique: number; occurrences: number };
}
export function calcStats(manifest: Manifest, phraseIndex: Set<string>, locale: string): TextStats;
```

**Правила:**

- `sentences` = `manifest.items.length`.
- `words/chars` — через `Intl.Segmenter` (или полифилл). `chars` считаем **графемами**.

### 2.6 `error.ts`

**Назначение:** нормализация ошибок в кодовые категории (i18n‑ключи формируются на уровне UI).

```ts
export type ErrorKind =
  | 'RATE_LIMIT'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVER'
  | 'OVERLOADED'
  | 'NETWORK'
  | 'PROXY_DOWN'
  | 'EXPIRED';
export interface NormalizedError {
  kind: ErrorKind;
  code?: number;
  detail?: string;
}
export function normalizeHttpError(code: number, detail?: string): NormalizedError;
export function normalizeNetworkError(e: unknown): NormalizedError;
```

**Маппинг по умолчанию:** `429→RATE_LIMIT`, `413→PAYLOAD_TOO_LARGE`, `500→SERVER`, `529→OVERLOADED`.
Отсутствие соединения/фейл health → `NETWORK/PROXY_DOWN`. Просрочка batch → `EXPIRED`.

### 2.7 `jsonl.ts`

**Назначение:** безопасный парсер JSONL (без выброса при единичной битой строке).

```ts
export interface JsonlParseReport {
  ok: JsonlLine[];
  bad: { line: number; error: string }[];
}
export function safeParseJsonl(text: string): JsonlParseReport;
```

### 2.8 `concurrency.ts`

**Назначение:** утилиты конкурентного доступа (без сетей/DOM).

```ts
export function singleFlight<T>(key: string, fn: () => Promise<T>): () => Promise<T>;
export function expBackoff(attempt: number, baseMs: number, maxMs: number): number;
```

### 2.9 (опц.) `positioning.ts`

**Назначение:** позиционирование всплывающих слоёв (чистая геометрия без DOM API; вход —
размеры/координаты). Поддержка «не выходить за viewport».

---

## 3) Безопасность и приватность

- Утилиты **не логируют** чувствительные данные (сырой текст/ключи/ответы LLM). Для диагностик
  возвращайте краткие `detail`.
- Любая функция, работающая с внешними структурами — сначала **валидация схемой**.

---

## 4) Тест‑стратегия для `utils`

- **Golden tests**: порядок предложений при сборке из манифеста/агрегации **всегда** совпадает с
  исходным.
- **Property‑based**: перестановки JSONL строк не меняют результат; дубликаты/пропуски SID корректно
  обрабатываются; FSM переходы детерминированы.
- **Unit**: каждый модуль отдельно (manifest/aggregator/fsm/error/jsonl/textStats).
- **Coverage**: критические ветки (ошибки/валидации/границы) закрыты.

---

## 5) Примеры (сокращённо)

### 5.1 `defaultSig`

```ts
export function normalizeLvForSig(s: string) {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim();
}
export function defaultSig(lvNorm: string, sid: number) {
  return Buffer.from(`${lvNorm}#${sid}`, 'utf8').toString('base64');
}
```

### 5.2 `aggregateBySid`

```ts
export function aggregateBySid(
  lines: JsonlLine[],
  cfg: SidKeyCfg = {},
): Map<number, CardAggregate> {
  const sidKey = cfg.sidKey ?? 'custom_id';
  const map = new Map<number, CardAggregate>();
  for (const line of lines) {
    const rawSid = (line as any)[sidKey];
    if (typeof rawSid !== 'number') continue;
    const sid = rawSid | 0;
    const prev = map.get(sid) ?? { sid, base: '', ctx: [] };
    const next = /* извлечь ru/ctx из line.result по договорённости схем */ prev;
    map.set(sid, next);
  }
  // каноникализация ru/ctx — при финальном проходе
  return map;
}
```

### 5.3 `batchReduce`

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
  switch (e.type) {
    case 'SUBMIT':
      return 'submitted';
    case 'TICK':
      return s === 'submitted' ? 'in_progress' : s;
    case 'RESOLVE':
      return 'ready';
    case 'REJECT':
      return 'failed';
  }
}
```

---

## 6) Чек‑лист перед PR

- [ ] Все функции **чистые**, без сетей/DOM/глобальных побочек.
- [ ] Порядок/агрегация опираются **только** на Manifest/SID; JSONL порядок игнорируется.
- [ ] Zod‑валидация на всех внешних границах; типы экспортированы.
- [ ] Никаких хардкодов конфигов; параметры передаются явно в аргументах.
- [ ] Ошибки нормализуются через `error.ts`; без утечки чувствительных данных в логи.
- [ ] Тесты: golden/property‑based/unit добавлены/обновлены.
- [ ] Ссылки на TRS/plan разделы присутствуют в описании PR.
