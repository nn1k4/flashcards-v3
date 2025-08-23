# reading.json

## Назначение и владелец (RACI кратко)

- Назначение: параметры производительности/UX tooltip-контроллера в режиме Reading.
- Владелец (R): Frontend Eng; A: Tech Lead; C: Core Eng; I: QA.

## Ключи и типы

| key                   | type    | default | required | range/enum | notes                     |
| --------------------- | ------- | ------- | -------: | ---------- | ------------------------- |
| tooltip.showDelayMs   | number  | 0       |      yes | ≥0         | Задержка показа подсказки |
| tooltip.debounceMs    | number  | 150     |      yes | ≥0         | Дебаунс событий           |
| tooltip.cancelOnLeave | boolean | true    |      yes | true/false | Отмена при уходе курсора  |
| tooltip.singleFlight  | boolean | true    |      yes | true/false | Без параллельных запросов |

## Примеры

Минимальный:

```json
{ "tooltip": { "showDelayMs": 0, "debounceMs": 150, "cancelOnLeave": true, "singleFlight": true } }
```

Расширенный:

```json
{
  "tooltip": { "showDelayMs": 250, "debounceMs": 300, "cancelOnLeave": true, "singleFlight": true }
}
```

## Зависимости/перекрёстные ссылки

- Используется в Reading tooltip/controller.
- Связан с политикой видимости (`flashcards.visibilityPolicy`).

## Инварианты/валидация

- Zod: `ZReadingConfig` (`src/types/config/reading.ts`).
- Все значения неотрицательны.

## Известные грабли

- Нулевые задержки на слабых устройствах могут привести к дрожанию подсказок.

## Changelog

- 2025-08-23 v1: Добавлен документ.
