# llm.json

## Назначение и владелец (RACI кратко)

- Назначение: параметры LLM-интеграции на клиенте (модель, tool_choice, базовые лимиты/политики кэша
  промптов).
- Владелец (R): Core Eng; A: Tech Lead; C: Backend; I: QA.

## Ключи и типы

| key                   | type    | default                   | required | range/enum | notes                     |
| --------------------- | ------- | ------------------------- | -------: | ---------- | ------------------------- |
| defaultModel          | string  | "claude-3-haiku-20240307" |      yes | —          | Имя модели провайдера     |
| maxTokensDefault      | number  | 1024                      |      yes | >0         | Базовый лимит токенов     |
| toolChoice            | string  | "flashcards_emitter"      |      yes | —          | Имя инструмента (emitter) |
| promptCaching.enabled | boolean | true                      |      yes | true/false | Включить кэш промптов     |

## Примеры

Минимальный:

```json
{
  "defaultModel": "model",
  "maxTokensDefault": 512,
  "toolChoice": "emitter",
  "promptCaching": { "enabled": true }
}
```

Расширенный:

```json
{
  "defaultModel": "claude-3-haiku-20240307",
  "maxTokensDefault": 1024,
  "toolChoice": "flashcards_emitter",
  "promptCaching": { "enabled": true }
}
```

## Зависимости/перекрёстные ссылки

- Используется в `src/api/client.ts` (заголовок `X-LLM-Model`).
- Политики tool-use/stop reasons — см. `doc/best_practices/tool-use.md`.

## Инварианты/валидация

- Zod: `ZLlmConfig` (`src/types/config/llm.ts`).
- Строки — непусты; числа > 0.

## Известные грабли

- Хардкод модели в коде запрещён (анти-хардкод проверка).

## Changelog

- 2025-08-23 v1: Добавлен документ, таблица ключей, примеры.
