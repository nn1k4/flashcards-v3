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
