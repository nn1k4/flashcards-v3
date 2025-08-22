# План реализации — Этап 5 (v2.0: Профили / Подписки / Локальные NLP / YouTube Captions)

Связка с ТЗ: **TRS v5.1** — §6 (импорт/экспорт), §12 (НФТ), §13 (интеграции LLM/MT/Media), §16
(конфиги), §17–§18 (приёмка/тесты), §20 («v2.0»). Приоритет доков: оф. Anthropic →
`doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` → `tool-use.md` → `Message Batches.md` /
`MessageBatches2.md`. Примечание: Этап **не нарушает** инварианты manifest/SID, tool-use, batch;
добавляет аккаунты, биллинг, локальный NLP/MT и YouTube Captions.

---

## 0) Цели этапа

- **Аккаунты/Профили:** аутентификация, синхронизация настроек и колод между устройствами;
  экспорт/удаление данных.
- **Подписки/Лимиты/Фичи:** платёжный провайдер, тарифы, квоты/feature-flags, учёт использования.
- **Локальный NLP/MT:** режимы `pipeline.mode = llm | local | hybrid`; Lemma/Dictionary/MT адаптеры,
  кэш.
- **YouTube Captions:** легальный (TOS-compliant) адаптер получения дорожек и VTT → Manifest
  anchors.
- **Безопасность:** серверный vault для ключей, шифрование, журнал аудита, резервные копии.
- **Config-first:** всё конфигурируемо (без хардкодов), i18n, доступность, тесты.

---

## 1) Архитектура и компоненты

- **Server (Node 24, ESM):** Fastify/Express; ORM: Prisma; БД: PostgreSQL (prod) / SQLite (dev);
  Redis (опц.) для сессий/квот/кэша.
- **Auth:** JWT (access/refresh, HttpOnly), CSRF-защита; OAuth2 (Google/GitHub — опц.), magic-link
  email (конфигом).
- **Secrets/Vault:** ключи провайдеров в БД **всегда** в шифре (AES-GCM/libsodium/KMS); на клиент не
  утекать.
- **Billing:** Stripe (или эквивалент), вебхуки, таблицы `subscriptions`, `invoices`.
- **Feature Flags & Entitlements:** таблицы `features`, `entitlements`, `usage`; SDK клиента для
  включения фич.
- **NLP Local Services:** отдельный процесс/worker; ONNX/transformers для MT; словарь/лемматизатор
  локально.
- **YouTube Captions:** Data API для списка дорожек → загрузка VTT; альтернативно — ручной импорт
  ссылки/файла.
- **Наблюдаемость:** метрики запросов/ошибок/квот; алёрты; audit-лог.

---

## 2) Рабочие пакеты

### 2.1 Аккаунты и аутентификация

- [ ] Маршруты: `/api/auth/register|login|refresh|logout`.
- [ ] Таблица `users`: email, name, locale, theme, createdAt, updatedAt.
- [ ] Сессии: refresh в HttpOnly cookie; ротация токенов; блок-листы при логауте.
- [ ] E2E: регистрация → логин → автопродление → логаут.

### 2.2 Профили и синхронизация

- [ ] `/api/profile/settings` (GET/PUT) — i18n, темы, хоткеи, targetLanguage, policies.
- [ ] `/api/decks` (CRUD, пагинация) и `/api/decks/:id/cards` — колоды и карточки; версии и
      `updatedAt`.
- [ ] Конфликт-резолюция: last-write-wins + версионирование; батч-операции.
- [ ] GDPR-опции: экспорт профиля/колод (JSON), удаление по запросу.
- [ ] UI: страница «Профиль» (Settings / Decks / Usage / Billing).

### 2.3 Хранилище ключей (Keys Vault)

- [ ] `/api/keys` (POST/GET/DELETE): сохранить/обновить ключи Anthropic/OpenAI/TTS/Images; ответы —
      только masked/exists.
- [ ] Проксирование вызовов на сервере с подстановкой пользовательского ключа (с проверкой
      тарифа/квот).
- [ ] Политики: разрешённые провайдеры/инструменты, ограничение доменов.

### 2.4 Подписки, квоты, фичи

- [ ] Stripe: продукты/тарифы (Free/Pro/Max), вебхуки (checkout/renew/cancel); таблица
      `subscriptions` с состояниями.
- [ ] `entitlements`: `maxTextLength`, `maxBatchesPerDay`, `ocrMinutes`, `mediaFollow`,
      `jsonlImport`, `ankiExport` и др.
- [ ] Учёт `usage`: middleware на прокси/ingestion/экспорт, период сброса; UX-баннеры при
      превышении.
- [ ] Feature-flags: rollout по пользователю/тарифу/проценту.

### 2.5 Локальный NLP/MT

- [ ] **LemmaAdapter**: леммы/морфо-теги (локальный сервис/библиотека).
- [ ] **DictionaryAdapter**: локальный словарь (SQLite/FTS JSON-индекс) → перевод + пометы.
- [ ] **MTAdapter**: модель `Helsinki-NLP/opus-mt-lv-ru` (или в зависимости от `targetLanguage`),
      режим ONNX/CPU; конфиг — `device`, `precision`, `maxLength`, `cache`.
- [ ] **Modes**:
  - `local`: карточки из Lemma+Dictionary; переводы предложений — MT;
  - `hybrid`: сложные случаи/амбигуити → LLM по правилам/скорингу;
  - `llm`: текущий путь без изменений.

- [ ] Качество: тестовые корпуса; минимальные метрики (BLEU/COMET) в отчёте; пороги в конфиге.

### 2.6 Кэш и производительность

- [ ] `TranslationCache`: ключ = (sentence + lang + mode); TTL/стратегии; прогрев на импорт/повторы.
- [ ] Кэш лемм/словаря (LRU/TTL); мониторинг hit-rate.

### 2.7 YouTube Captions Adapter

- [ ] Получение списка дорожек через YouTube Data API (при ключе и правах); выбор дорожки; загрузка
      VTT.
- [ ] Fallback: ручной ввод URL дорожки или загрузка VTT/JSON пользователем.
- [ ] Парсинг → anchors в `manifest.meta` (SID-mapping по порядку).
- [ ] Ограничения/квоты API; локализованные ошибки/советы.

### 2.8 Безопасность, приватность, соответствие

- [ ] Шифрование PII/ключей (AES-GCM/libsodium/KMS); пароли — Argon2.
- [ ] Политика хранения: retention; экспорт/удаление всех данных профиля.
- [ ] Логи без сырого текста/ключей; audit-таблица `audit_logs` (кто/что/когда).
- [ ] Бэкапы БД; DR-план.

### 2.9 Наблюдаемость и алёрты

- [ ] Метрики: latency, error rate, 429/529, usage per user/tier.
- [ ] Алёрты: всплески 429/529, падение вебхуков, рост отказов платежей, переполнение диска.

### 2.10 Миграции и совместимость

- [ ] Prisma миграции; перенос локальных данных в облачный профиль; back-compat export
      (JSON/Anki/Quizlet).
- [ ] Версионирование схем/конфигов; скрипты миграций.

---

## 3) Конфиги (добавления)

```jsonc
// config/account.json
{
  "profiles": true,
  "sync": true,
  "auth": { "providers": { "emailLink": true, "oauth": ["google"] } }
}
// config/entitlements.json
{
  "free":  { "maxTextLength": 8000,  "jsonlImport": false },
  "pro":   { "maxTextLength": 40000, "jsonlImport": true, "mediaFollow": true },
  "max":   { "maxTextLength": 120000, "ocrMinutes": 120, "ankiExport": true }
}
// config/pipeline.json
{ "mode": "hybrid" } // llm | local | hybrid
// config/nlp.json
{
  "lemma": { "provider": "local" },
  "dictionary": { "provider": "local" },
  "mt": { "provider": "local", "model": "Helsinki-NLP/opus-mt-lv-ru", "device": "cpu", "cache": true }
}
// config/youtube.json
{ "enabled": true, "requireUserApiKey": true, "quotaTips": true }
// config/security.json
{ "encryption": "aes-gcm", "kms": false, "audit": true }
```

Все ключи имеют Zod-схемы; `npm run validate:config` обязателен.

---

## 4) Спринты (продолжение нумерации)

### S27 — Auth & Profiles

Аккаунты, сессии, страница профиля, CRUD настроек; E2E happy-path.

### S28 — Keys Vault & Proxy

Vault API, маскирование ключей, проксирование вызовов с ключами, политики провайдеров.

### S29 — Billing & Entitlements

Stripe, вебхуки, тарифы/лимиты, usage-учёт, UI Billing.

### S30 — Local NLP/MT

Lemma/Dictionary/MT, режимы pipeline, кэши, базовые метрики качества.

### S31 — YouTube Captions

Список дорожек → VTT → anchors; квоты/ошибки; UX выбора дорожки.

### S32 — Security & Compliance

Шифрование, audit-лог, экспорт/удаление данных, бэкапы/DR.

### S33 — Docs & Tests

RU-доки, схемы, E2E на профили/квоты/NLP/YouTube; линт/валидаторы.

### S34 — Polish & Release

Оптимизация, дефекты, релиз v2.0.

---

## 5) Definition of Done (DoD)

- Вход/выход пользователя работает; настройки/колоды синхронизируются между устройствами.
- Ключи провайдеров хранятся **только на сервере**, зашифрованы; на клиент не отдаются (только
  masked).
- Подписки активируют фичи/квоты; при превышении — корректные баннеры и блокировки; Billing UI
  отражает статус.
- `pipeline.mode` переключает источник карточек/перевода; локальный MT/словарь/лемматизация
  работают; кэш уменьшает повторы.
- YouTube Captions: выбор дорожки, загрузка VTT, anchors в `manifest.meta`; интеграция с
  follow-highlight (этап 4) стабильна.
- Документация/конфиги полные; Zod-валидация зелёная; unit/integration/E2E — зелёные.

---

## 6) Риски и меры

- **Безопасность ключей/PII** → строгая серверная изоляция, AES-GCM, ограниченные логи,
  периодическая ротация.
- **Биллинг/юридические аспекты** → sandbox, надёжные вебхуки, обработка отказов/возвратов, чёткий
  UX.
- **Производительность локального MT** → кэш, тюнинг, лимиты устройств; опция отключения для слабых
  машин.
- **Квоты YouTube API** → graceful degradation, подсказки; ручной импорт как fallback.
- **Миграции** → пошаговые Prisma-миграции, бэкапы, тестовые прогоны на копии БД.

---

## 7) Артефакты

- ER-диаграмма (`doc/architecture_db.mmd`), спецификации API (OpenAPI), чек-листы аудита
  безопасности.
- Доки конфигов: `account.md`, `entitlements.md`, `nlp.md`, `youtube.md`, `security.md`.
- Примеры экспортов данных пользователя (GDPR), примеры VTT и anchors-mapping.
