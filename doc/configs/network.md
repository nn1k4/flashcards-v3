# network.json

## Назначение и владелец (RACI кратко)

- Назначение: сетевые параметры клиента (базовый URL прокси, таймауты, префикс LLM-маршрутов).
- Владелец (R): Core Eng; A: Tech Lead; C: Frontend Eng; I: QA.

## Ключи и типы

| key              | type   | default   | required | range/enum | notes                           |
| ---------------- | ------ | --------- | -------: | ---------- | ------------------------------- |
| apiBaseUrl       | string | "/api"    |      yes | URL path   | База для проксируемых маршрутов |
| requestTimeoutMs | number | 15000     |      yes | >0         | Таймаут запросов (мс)           |
| healthTimeoutMs  | number | 3000      |      yes | >0         | Таймаут health-пинга (мс)       |
| llmRouteBase     | string | "/claude" |       no | path       | Префикс LLM-маршрутов на прокси |

## Примеры

Минимальный:

```json
{ "apiBaseUrl": "/api", "requestTimeoutMs": 15000, "healthTimeoutMs": 3000 }
```

Расширенный:

```json
{
  "apiBaseUrl": "/api",
  "requestTimeoutMs": 20000,
  "healthTimeoutMs": 4000,
  "llmRouteBase": "/claude"
}
```

## Зависимости/перекрёстные ссылки

- Используется HTTP-клиентом `src/api/client.ts`.
- Привязан к `/server` и фронтовым прокси-настройкам Vite.

## Инварианты/валидация

- Zod: `ZNetworkConfig` (`src/types/config/network.ts`).
- Таймауты > 0 мс; `apiBaseUrl` — непустой путь.

## Известные грабли

- Несогласованность `apiBaseUrl` с dev-прокси приведёт к CORS/404.

## Changelog

- 2025-08-23 v1: Добавлен документ; отражён `llmRouteBase`.
