# flashcards.json

## Назначение и владелец (RACI кратко)

- Назначение: параметры отображения карточек (кол-во контекстов, шрифт, политика видимости).
- Владелец (R): Frontend Eng; A: Tech Lead; C: Core Eng; I: QA.

## Ключи и типы

| key              | type          | default             |      required | range/enum | notes                       |
| ---------------- | ------------- | ------------------- | ------------: | ---------- | --------------------------- | ------------------ |
| contexts.default | number        | 1                   |           yes | >0         | Контекстов по умолчанию     |
| contexts.max     | number        | 3                   |           yes | ≥ default  | Максимум при «показать ещё» |
| fontFamily       | string        | "Noto Sans Display" |           yes | —          | Шрифт карточек              |
| visibilityPolicy | "all-visible" | "reveal-on-peek"    | "all-visible" | yes        | enum                        | Политика видимости |

## Примеры

Минимальный:

```json
{
  "contexts": { "default": 1, "max": 3 },
  "fontFamily": "Noto Sans Display",
  "visibilityPolicy": "all-visible"
}
```

Расширенный:

```json
{
  "contexts": { "default": 2, "max": 5 },
  "fontFamily": "Noto Sans Display",
  "visibilityPolicy": "reveal-on-peek"
}
```

## Зависимости/перекрёстные ссылки

- Используется в представлениях Flashcards/Edit/Reading (видимость и контент).
- См. TRS §5.2/§5.5 и план v1.1 (reveal-on-peek).

## Инварианты/валидация

- Zod: `ZFlashcardsConfig` (`src/types/config/flashcards.ts`).
- `contexts.max` ≥ `contexts.default`.

## Известные грабли

- При `reveal-on-peek` скрытые карточки будут открываться после подсказок в Reading.

## Changelog

- 2025-08-23 v1: Добавлен документ.
