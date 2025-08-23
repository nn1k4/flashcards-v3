# theme.json

## Назначение и владелец (RACI кратко)

- Назначение: конфигурация темы UI (light/dark/system) и CSS-класс для тёмной темы.
- Владелец (R): Frontend Eng; A: Tech Lead; C: Core Eng; I: QA.

## Ключи и типы

| key       | type                  | default | required | range/enum | notes                      |
| --------- | --------------------- | ------- | -------: | ---------- | -------------------------- | ---- | ----------------------- |
| default   | "light"               | "dark"  | "system" | "system"   | yes                        | enum | Режим темы по умолчанию |
| darkClass | string                | "dark"  |      yes | —          | CSS-класс для `<html>`     |
| tokens    | record<string,string> | {}      |       no | —          | Доп. токены (цвета и т.п.) |

## Примеры

Минимальный:

```json
{ "default": "system", "darkClass": "dark" }
```

Расширенный:

```json
{
  "default": "dark",
  "darkClass": "dark",
  "tokens": { "primary": "#1e40af" }
}
```

## Зависимости/перекрёстные ссылки

- Используется провайдером темы (`src/stores/themeStore.tsx`).
- В связке с Tailwind токенами/классами в стиле.

## Инварианты/валидация

- Zod: `ZThemeConfig` (`src/types/config/theme.ts`).
- `default` ∈ {light,dark,system}; `darkClass` — непустая строка.

## Известные грабли

- Забытый `darkClass` приведёт к отсутствию применения тёмной темы.

## Changelog

- 2025-08-23 v1: Добавлен документ, таблица ключей.
