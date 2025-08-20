# План реализации — Этап 5 (v2.0: Профили/Подписки/Локальные NLP/YouTube Captions)

Связка с ТЗ: TRS v5.0 — §22 (медиасинхронизация — задействовано косвенно), §23
(профили/ключи/подписки), §24 (локальный NLP/MT), §21.6 (YouTubeCaptionsAdapter), §16 (конфиги),
§17–§18 (приёмка/тесты), §20 «План релизов (v2.0)».

## 0) Цели этапа

- Добавить **профили пользователей** с синхронизацией настроек/колод, безопасное хранение
  персональных **API‑ключей** (Anthropic/OpenAI/TTS/Images и т.д.).
- Внедрить **подписки/лимиты/фичи** (tiers) и **feature‑flags** на уровне сервера и клиента.
- Реализовать **локальный NLP‑путь**: Lemma/Dictionary/MT (Helsinki‑NLP/TildeLM), режимы
  `pipeline.mode = llm|local|hybrid` + кэширование.
- Поддержать **YouTube Captions** (официальные API, TOS‑compliant) как дополнительный источник
  субтитров.
- Обеспечить безопасность, соответствие конфиг‑политике, бэкапы, экспорт/удаление данных
  пользователя.

Не входят: полноценная нативная мобильная публикация (за рамками v2.0), генерация TTS/Images по
умолчанию (оставляем за флагами).

---

## 1) Архитектура и компоненты

- **Сервер (Node 24, ESM)**: Fastify/Express, PostgreSQL (или SQLite для dev) через Prisma; Redis
  (опц.) для сессий/квот/кэша.
- **Auth**: JWT (access/refresh) + OAuth2 (Google/GitHub — опц.) + email link (magic).
- **Secrets**: пользовательские API‑ключи — шифрование (libsodium/AES‑GCM), KMS/ключ из .env;
  хранение только на сервере.
- **Billing**: Stripe/ЮKassa (одно из); вебхуки; таблица подписок/чеков.
- **Feature flags & quotas**: таблицы `features`, `entitlements`, `usage` (rate/quota per
  user/tier).
- **NLP Local**: сервис‑провайдер в отдельном процессе/worker; модели скачиваются/кешируются; API
  адаптеры.
- **YouTube Captions**: адаптер получения списка дорожек → загрузка VTT/JSON; проверка прав/доступа.

---

## 2) Рабочие пакеты

### 2.1 Аккаунты и аутентификация

- [ ] Маршруты: `/api/auth/register`, `/login`, `/refresh`, `/logout`.
- [ ] Хранение пользователя: profile (i18n/theme/hotkeys), preferences, timestamps; таблица `users`.
- [ ] Сессии: refresh‑token в HttpOnly cookie; CSRF‑защита.
- [ ] E2E: регистрация, логин, восстановление сессии.

### 2.2 Синхронизация настроек и колод

- [ ] Маршруты: `/api/profile/settings` (GET/PUT), `/api/decks` (GET/POST/PUT/DELETE; пагинация),
      `/api/decks/:id/cards`.
- [ ] Конфликт‑резолюция (last‑write‑wins + версии); экспорт/импорт пользовательских данных (GDPR
      download + delete).
- [ ] UI: страница Профиль → вкладки Settings/Decks/Usage/Billing.

### 2.3 Хранилище ключей и интеграции провайдеров

- [ ] Маршруты: `/api/keys` (POST/GET/DELETE) — сохранить/заменить ключи провайдеров; ключи **не**
      возвращаются в явном виде (только masked/exists).
- [ ] Проксирование вызовов с подстановкой ключа пользователя (если разрешено тарифом); логирование
      минимальное, без сырого текста запросов.
- [ ] Политики: per‑provider enable/disable; ограничение на домены/инструменты.

### 2.4 Подписки, лимиты и фичи

- [ ] Интеграция **Stripe**: продукты/планы (Free/Pro/Max), вебхуки (checkout/session/renew/cancel),
      таблица `subscriptions`.
- [ ] Квоты: `maxTextLength`, `maxBatchesPerDay`, `ocrMinutes`, `mediaFollow`, `jsonlImport`,
      `ankiExport` и т.д. — в `entitlements`.
- [ ] Реал‑тайм подсчёт usage: middleware на прокси/ingestion/экспорт.
- [ ] UI: страница Billing (план/статус/лимиты/история).

### 2.5 Feature Flags

- [ ] Таблица `features` с rollout (global %, per‑user, per‑tier); SDK на клиента.
- [ ] Примеры: `revealOnPeek`, `hoverTTS`, `contextMenu`, `youtubeCaptions`, `localMT`.

### 2.6 Локальный NLP/MT

- [ ] **LemmaAdapter**: лемматизация/морфо‑теги (локальный сервис/библиотека), API
      `analyze(tokens): Lemma[]`.
- [ ] **DictionaryAdapter**: локальный словарь (SQLite/JSON‑индекс) → перевод слова + пометы.
- [ ] **MTAdapter**: загрузка модели **Helsinki‑NLP/opus‑mt‑lv‑ru** (или `lv-uk`, в зависимости от
      targetLanguage); ONNX/transformers; конфиг: `device`, `precision`, `maxLength`, `cache`.
- [ ] **Pipeline**: `pipeline.mode = local | hybrid | llm`:
  - `local`: карточки из Lemma+Dictionary; предложения через MT;
  - `hybrid`: сложные случаи → LLM (правило/скоринг по длине/амбигуити).
- [ ] Качество: тестовые корпуса; BLEU/COMET (минимальный отчёт); конфиг порогов.

### 2.7 Кэш и производительность

- [ ] `TranslationCache` (ключ: sentence+lang+mode), TTL, warmup при импорте.
- [ ] Кэш лемм и словарных ответов.

### 2.8 YouTube Captions Adapter

- [ ] Получение списка дорожек через YouTube Data API (при наличии ключа и прав пользователя); выбор
      дорожки; загрузка VTT.
- [ ] Резерв: ручная вставка URL дорожки/скачивание пользователем файла.
- [ ] Ограничения/квоты API; i18n‑ошибки.

### 2.9 Безопасность, приватность, соответствие

- [ ] Шифрование PII и ключей (AES‑GCM), пароли — Argon2.
- [ ] Политика хранения данных: retention/удаление по запросу, экспорт всех данных пользователя.
- [ ] Логи без персональных данных/ключей; аудит таблица `audit_logs`.
- [ ] Резервные копии БД; disaster‑recovery сценарии.

### 2.10 Наблюдаемость и алёрты

- [ ] Telemetry: request metrics, error rates, latency; дашборд.
- [ ] Алёрты: превышение 429/529, неудачные вебхуки, заполнение диска.

### 2.11 Миграции/обратная совместимость

- [ ] Prisma миграции; мигрирование существующих локальных данных пользователя в серверные профили.
- [ ] Совместимость экспортных форматов (JSON/ANKI/Quizlet) с учётом новых полей.

---

## 3) Конфиги (добавления)

```json
{
  "account": {
    "profiles": true,
    "subscriptions": true,
    "sync": true,
    "providers": { "oauth": ["google"], "emailLink": true }
  },
  "entitlements": {
    "free": { "maxTextLength": 8000, "jsonlImport": false },
    "pro": { "maxTextLength": 40000, "jsonlImport": true },
    "max": { "maxTextLength": 120000, "ocrMinutes": 120, "mediaFollow": true }
  },
  "pipeline": { "mode": "hybrid" },
  "nlp": {
    "lemma": { "provider": "local" },
    "dictionary": { "provider": "local" },
    "mt": {
      "provider": "local",
      "model": "Helsinki-NLP/opus-mt-lv-ru",
      "device": "cpu",
      "cache": true
    }
  },
  "youtube": { "enabled": true, "requireUserApiKey": true }
}
```

---

## 4) Спринты

### S25 — Auth & Profiles

- Аккаунты, сессии, настройки профиля, синхронизация.

### S26 — Keys Vault & Providers

- Сохранение/маскирование/проксирование ключей; политики провайдеров.

### S27 — Billing & Entitlements

- Интеграция платежей, лимиты/usage, UI Billing.

### S28 — Local NLP/MT

- Lemma/Dictionary/MT, pipeline modes, кэш, базовые метрики качества.

### S29 — YouTube Captions

- Получение дорожек, загрузка VTT, лимиты, UX.

### S30 — Security/Compliance

- Аудит, бэкапы, экспорт/удаление данных, логирование.

### S31 — Docs & Tests

- RU‑доки, схемы, E2E на профили, квоты, NLP/MT и YouTube.

### S32 — Polish & Release

- Оптимизация, устранение дефектов, релиз v2.0.

---

## 5) Definition of Done (DoD)

- Логин/регистрация/выход работают; настройки профиля и колоды синхронизируются между устройствами.
- Ключи провайдеров хранятся шифрованно; не утекут на клиент; проксируются корректно.
- Подписки активируют фичи/лимиты; usage учитывается; биллинг отражается в UI.
- `pipeline.mode` переключает источник перевода/карточек; кэш уменьшает повторы; качество локального
  MT подтверждено на тест‑наборах.
- YouTube Captions доступны через официальный API/или ручной импорт; дорожки выбираются и мапятся в
  SID.
- Документация и конфиги полные; все тесты зелёные.

---

## 6) Риски и меры

- **Безопасность ключей**: строгая серверная изоляция, шифрование на диске, ограничение логов,
  периодическая ротация.
- **Биллинг и юридические аспекты**: песочница Stripe, корректная обработка вебхуков, политика
  возвратов.
- **Производительность локального MT**: кэш, тюнинг модели, ограничение устройств; возможность
  отключить для слабых машин.
- **Квоты YouTube API**: graceful degradation, подсказки пользователю, ручной импорт субтитров как
  fallback.
- **Миграции данных**: пошаговые миграции, резервные копии, тестовые прогоны на копии БД.
