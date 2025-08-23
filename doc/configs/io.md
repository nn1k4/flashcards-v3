# io.json

## Назначение и владелец (RACI кратко)

- Назначение: параметры импорта/экспорта данных приложения.
- Владелец (R): Core Eng; A: Tech Lead; C: Frontend Eng; I: QA.

## Ключи и типы

| key                  | type     | default                 | required | range/enum      | notes                                |
| -------------------- | -------- | ----------------------- | -------: | --------------- | ------------------------------------ | --------------------- | ----------------- |
| import.allowed       | string[] | ["json"]                |      yes | file extensions | Допустимые типы импортируемых файлов |
| import.maxFileSizeMB | number   | 20                      |      yes | >0              | Лимит размера файла (МБ)             |
| import.defaultMerge  | enum     | "merge-prefer-imported" |      yes | replace-all     | merge-keep-local                     | merge-prefer-imported | Стратегия слияния |
| export.formats       | string[] | ["json"]                |      yes | format ids      | Список форматов экспорта             |
| export.includeMeta   | boolean  | true                    |      yes | true/false      | Включать метаданные экспорта         |

## Примеры

Минимальный:

```json
{
  "import": { "allowed": ["json"], "maxFileSizeMB": 10, "defaultMerge": "merge-prefer-imported" },
  "export": { "formats": ["json"], "includeMeta": true }
}
```

Расширенный:

```json
{
  "import": { "allowed": ["json"], "maxFileSizeMB": 20, "defaultMerge": "merge-keep-local" },
  "export": { "formats": ["json"], "includeMeta": true }
}
```

## Зависимости/перекрёстные ссылки

- Связь с режимами Import/Export UI.
- В v1.1 добавится JSONL-импорт (см. план §S10).

## Инварианты/валидация

- Zod: `ZIoConfig` (`src/types/config/io.ts`).
- Значения > 0, стратегии ∈ enum.

## Известные грабли

- Завышенный `maxFileSizeMB` может приводить к долгим операциям/памяти браузера.

## Changelog

- 2025-08-23 v1: Добавлен документ, примеры.
