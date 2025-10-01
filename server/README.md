# Server (mock-proxy) — Runtime & Routes

- Runtime: CommonJS mock-proxy (ts-node + nodemon). Временная мера для простоты запуска в dev.
- Почему CJS: минимальная конфигурация для локальной разработки; ESM‑миграция запланирована после
  v1.0.
- Маршруты:
  - Health: `GET /health`
  - Single (tools mock): `POST /claude/single` — возвращает `tool_use` блока `emit_flashcards` с
    JSON‑payload (строгий JSON‑only mock)
  - Batch: `POST /claude/batch`, `GET /claude/batch/:batchId`, `GET /claude/batch/:batchId/status`,
    `DELETE /claude/batch/:batchId`
- Batch JSONL builder: `POST /claude/batch/build-jsonl` — принимает `manifest` и возвращает массив
  строк `.jsonl` (каждая с `{ custom_id, params }`), где `params` содержит `tools` и `tool_choice`
  для JSON‑only tool‑use.
- Provider stubs (feature-flagged):
  - `POST /claude/provider/single`
  - `POST /claude/provider/batch/build-jsonl` По умолчанию возвращают 501 (disabled). Включите
    интеграцию явным коммитом/переменными окружения в будущем (см. план S2).
  - Vite dev proxy: `/api/* → <llmRouteBase>/*` (по умолчанию `<llmRouteBase> = /claude`).
- Поведение mock: детерминированные ошибки для `sid % 4 === 1` — удобны для тестов баннеров/ретраев.

## Как запустить (dev)

```bash
npm run dev
```

- Клиент поднимет Vite, сервер — nodemon + ts-node.
- Проверка: `GET http://localhost:<serverPort>/health` → `{ ok: true }`.

## План миграции в ESM (после v1.0)

- Переключить раннер: `tsx` или `ts-node --esm`.
- Обновить `nodemon.json`/скрипты (`exec` → ESM‑совместимый раннер).
- Проверить импорт пути/расширения (`type: module`, `moduleResolution`), заменить
  `require`/`__dirname` паттерны.
- Smoke‑тесты маршрутов и прокси‑карты (`/api/* → <llmRouteBase>/*`).

Примечание: текущая реализация `single/builder` — mock для фронтенд‑разработки и тестов; реальную
интеграцию с провайдером LLM добавим отдельным коммитом, сохраняя JSON‑only контракт и
`tool_choice`.

## Env (provider feature flag)

Включение прод‑провайдера управляется переменными окружения на сервере:

- `ANTHROPIC_API_KEY` — если пусто, `/claude/provider/*` вернёт `501`.
- `ANTHROPIC_API_URL` — по умолчанию `https://api.anthropic.com/v1/messages`.
- `ANTHROPIC_VERSION` — по умолчанию `2023-06-01`.
- `ANTHROPIC_MODEL` — по умолчанию `claude-3-haiku-20240307`.
- `PROVIDER_TIMEOUT_MS` — таймаут запроса к провайдеру (мс), по умолчанию `15000`.
- `ALLOWED_ORIGINS` — список разрешённых Origin, через запятую. Если не задан, в dev разрешено всё.

На клиенте включите `config/llm.json → useProvider: true`, чтобы маршруты переключились на
`/claude/provider/*`.

## Security notes

- CORS: в dev разрешены все Origin; для prod задайте `ALLOWED_ORIGINS`.
- JSON‑лимит: глобально `1mb`; рекомендуется держать provider payloads «короткими».
- Логи: не логируйте PII/сырые ответы модели в проде; используйте агрегированные метрики.
