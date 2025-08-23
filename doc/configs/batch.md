# batch.json

## Назначение и владелец (RACI кратко)

- Назначение: стратегия polling статуса batch (адаптивные интервалы) и уважение `Retry-After`.
- Владелец (R): Core Eng; A: Tech Lead; C: Frontend Eng; I: QA.

## Ключи и типы

| key                       | type                         | default              | required | range/enum | notes                             |
| ------------------------- | ---------------------------- | -------------------- | -------: | ---------- | --------------------------------- |
| polling.stages            | Array<{fromSec,minMs,maxMs}> | 4 этапа (см. пример) |      yes | >0         | Порог времени и интервалы опроса  |
| polling.respectRetryAfter | boolean                      | true                 |      yes | true/false | Учитывать заголовок `Retry-After` |

## Примеры

Минимальный:

```json
{
  "polling": {
    "stages": [{ "fromSec": 0, "minMs": 1000, "maxMs": 2000 }],
    "respectRetryAfter": true
  }
}
```

Расширенный:

```json
{
  "polling": {
    "stages": [
      { "fromSec": 0, "minMs": 1000, "maxMs": 2000 },
      { "fromSec": 10, "minMs": 3000, "maxMs": 5000 },
      { "fromSec": 60, "minMs": 10000, "maxMs": 30000 },
      { "fromSec": 600, "minMs": 30000, "maxMs": 60000 }
    ],
    "respectRetryAfter": true
  }
}
```

## Зависимости/перекрёстные ссылки

- Используется в хук-поллере статусов batch (UI, FSM).
- См. TRS §5/§7 и `doc/best_practices/Message Batches.md`.

## Инварианты/валидация

- Zod: `ZBatchConfig` (`src/types/config/batch.ts`).
- Все интервалы и пороги — > 0; `fromSec` — неотрицательный.

## Известные грабли

- Игнорирование `Retry-After` ведёт к излишним запросам/429.

## Changelog

- 2025-08-23 v1: Добавлен документ, примеры, ссылки.
