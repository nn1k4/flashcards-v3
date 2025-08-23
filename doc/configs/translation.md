# translation.json

## Назначение и владелец (RACI кратко)

- Назначение: включение/отключение показателей панели статистик в режиме Translation.
- Владелец (R): Frontend Eng; A: Tech Lead; C: Core Eng; I: QA.

## Ключи и типы

| key             | type    | default | required | range/enum | notes                        |
| --------------- | ------- | ------- | -------: | ---------- | ---------------------------- |
| stats.words     | boolean | true    |      yes | —          | Счётчик слов (UAX-29)        |
| stats.graphemes | boolean | true    |      yes | —          | Счётчик графем               |
| stats.sentences | boolean | true    |      yes | —          | Счётчик предложений (по SID) |
| stats.phrases   | boolean | true    |      yes | —          | Фразы (unique/occurrences)   |

## Примеры

Минимальный:

```json
{ "stats": { "words": true, "graphemes": true, "sentences": true, "phrases": true } }
```

Расширенный:

```json
{ "stats": { "words": true, "graphemes": false, "sentences": true, "phrases": true } }
```

## Зависимости/перекрёстные ссылки

- Используется в UI Translation панели.
- Связан с подсчётом статистик utils (см. TRS §5.4).

## Инварианты/валидация

- Zod: `ZTranslationConfig` (`src/types/config/translation.ts`).

## Известные грабли

- Отключение отдельных показателей может сбивать ожидания QA/пользователей.

## Changelog

- 2025-08-23 v1: Добавлен документ.
