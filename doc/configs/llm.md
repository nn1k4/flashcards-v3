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

# llm.json

## Назначение и владелец (RACI кратко)

- Назначение: базовые настройки LLM (модель, лимиты токенов, инструмент по умолчанию) и фича‑флаг
  провайдера для клиентских маршрутов.
- Владелец (R): Core Eng; A: Tech Lead; C: Frontend Eng; I: QA.

## Ключи и типы

| key                   | type    | default                   | required | notes                                  |
| --------------------- | ------- | ------------------------- | -------: | -------------------------------------- |
| defaultModel          | string  | "claude-3-haiku-20240307" |      yes | Базовая модель для single/batch        |
| maxTokensDefault      | number  | 1024                      |      yes | Лимит токенов для single tool‑use      |
| toolChoice            | string  | "flashcards_emitter"      |      yes | Имя единственного инструмента          |
| useProvider           | boolean | false                     |       no | Включает маршруты `/claude/provider/*` |
| promptCaching.enabled | boolean | true                      |       no | Глобальный флаг prompt‑caching         |

## Примеры

Минимальный:

```json
{
  "defaultModel": "claude-3-haiku-20240307",
  "maxTokensDefault": 1024,
  "toolChoice": "flashcards_emitter"
}
```

С провайдером (dev/prod):

```json
{
  "defaultModel": "claude-3-haiku-20240307",
  "maxTokensDefault": 1024,
  "toolChoice": "flashcards_emitter",
  "useProvider": true,
  "promptCaching": { "enabled": true }
}
```

## Взаимосвязи / окружение

- При `useProvider=true` клиентские вызовы пойдут на `/claude/provider/*`.
- Сервер должен иметь заданные переменные окружения (см. server/README.md: Env):
  `ANTHROPIC_API_KEY`, опц. `ANTHROPIC_API_URL`, `ANTHROPIC_VERSION`, `ANTHROPIC_MODEL`.

## Пример .env (server)

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
ANTHROPIC_VERSION=2023-06-01
ANTHROPIC_MODEL=claude-3-haiku-20240307
PROVIDER_TIMEOUT_MS=15000
ALLOWED_ORIGINS=http://localhost:5173
```

## Инварианты/валидация

- Zod: `ZLlmConfig` (`src/types/config/llm.ts`).
- При `useProvider=true` отсутствие ключа на сервере приведёт к 501 на `/claude/provider/*`.
