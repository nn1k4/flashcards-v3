# app.json

## Назначение и владелец (RACI кратко)

- Назначение: базовая информация приложения и локаль по умолчанию (ориентиры для UI/i18n).
- Владелец (R): Core Eng; A: Tech Lead; C: Frontend Eng; I: QA.

## Ключи и типы

| key              | type     | default         | required | range/enum | notes                       |
| ---------------- | -------- | --------------- | -------: | ---------- | --------------------------- |
| appName          | string   | "flashcards-v3" |      yes | —          | Отображаемое имя приложения |
| version          | string   | "0.1.0"         |      yes | semver     | Версия сборки/приложения    |
| defaultLocale    | string   | "en"            |      yes | ISO code   | Начальная локаль UI         |
| supportedLocales | string[] | ["en","ru"]     |      yes | ISO codes  | Список доступных локалей    |

## Примеры

Минимальный:

```json
{
  "appName": "flashcards-v3",
  "version": "0.1.0",
  "defaultLocale": "en",
  "supportedLocales": ["en"]
}
```

Расширенный:

```json
{
  "appName": "flashcards-v3",
  "version": "0.1.0",
  "defaultLocale": "ru",
  "supportedLocales": ["en", "ru"]
}
```

## Зависимости/перекрёстные ссылки

- Используется провайдерами i18n (`src/stores/i18nStore.tsx`).
- Связан с `i18n.json` (поддерживаемые локали) и `doc/configs/i18n.md`.
- Отражается в UI (заголовки/язык по умолчанию).

## Инварианты/валидация

- Zod: `ZAppConfig` (`src/types/config/app.ts`).
- `supportedLocales` — непустой массив; `defaultLocale` ∈ `supportedLocales`.

## Известные грабли

- Несоответствие `defaultLocale` и списка `supportedLocales` приведёт к откату к `en` на клиенте.

## Changelog

- 2025-08-23 v1: Добавлен документ, таблица ключей, примеры, ссылки.
