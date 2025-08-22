# План реализации — Этап 2 (v1.1)

Связка с ТЗ: **TRS v5.1** (§5.1, §5.5, §6, §7, §8, §9, §10, §15, §16, §17, §18, §20 — «v1.1»).
Приоритет доков: оф. Anthropic → `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` →
`Message Batches.md` / `MessageBatches2.md` → `tool-use.md`.

---

## 0) Цели этапа

- **Импорт JSONL** (офлайн-результаты Anthropic Console) с превью diff и стратегиями merge.
- **Restore/Undo** в Edit (откат ко входному состоянию + локальный бэкап/Undo окно).
- **Контекстное меню** в Reading (ПКМ/long-press) — настраиваемые действия, белый список доменов.
- **Политика видимости `reveal-on-peek`** — карточки становятся видимыми после подсказки.
- **Stop-reasons UX**: пользовательские баннеры и **Retry** для `max_tokens` (single bump / batch
  split-retry), телеметрия.
- Обновить доки/конфиги/AGENT/Codex; убедиться в **config-first** и отсутствии хардкодов.

Не входят: OCR/PDF/Images/Subtitles (v1.2), Media follow-highlight/экспорт Anki/Quizlet (v1.3),
профили/подписки (v2.0).

---

## 1) Рабочие пакеты

### 1.1 Импорт JSONL (Anthropic Batches)

**Конфиг/схемы**

- [ ] `config/io.json`:
      `import: { "allowed": ["json","jsonl"], "defaultMerge": "merge-keep-local", "maxFileSizeMB": 50 }`.
- [ ] Zod-схема `schemas/io.ts`: ограничения размера/типов, опции стратегий.

**Парсер**

- [ ] `src/io/jsonl.ts` (streaming): чтение построчно → `JSON.parse` с защитой; извлечение
      `custom_id` (SID), `status`, `result`.
- [ ] **tool-use parity**: если строка содержит `tool_use` — брать **`tool_use.input`**, иначе —
      контентный JSON (строгий JSON-only).
- [ ] Zod-валидация DTO **до** агрегации; отчёт об ошибочных строках с указанием номеров.
- [ ] Агрегация **по SID** (порядок строк игнорируется); хранить
      `status: succeeded|errored|canceled|expired` + diagnostic.

**UI/UX**

- [ ] Модал «Импорт JSONL»: — превью diff (новые/изменённые карточки/контексты/видимость), — выбор
      стратегии: `replace-all | merge-keep-local | merge-prefer-imported` (дефолт — из конфига), —
      баннеры: тип файла, превышение `maxFileSizeMB`, повреждённые строки.
- [ ] Локализация текстов; индикатор прогресса для крупных файлов.

**Тесты**

- [ ] Unit: потоковый парсинг, Zod ошибки, merge-стратегии, агрегация по SID.
- [ ] E2E: успешный импорт → состояние обновлено; частично битый файл → валидные строки загружены,
      ошибки показаны.

---

### 1.2 Restore/Undo в Edit

**Модель данных**

- [ ] `BackupStore` (ring-buffer) c TTL (`io.restore.undoWindowMs`) и флагом
      `io.restore.makeBackupBefore`.
- [ ] Снимок включает: карточки (вкл. видимость/peeked), контексты, настройки targetLanguage.

**UX**

- [ ] Кнопка **Restore** (в Edit рядом с Add): сводка затрагиваемых сущностей → подтверждение.
- [ ] Действие **Restore**: — откат всех ручных правок (база/контексты), — удалённые
      восстанавливаются, добавленные пользователем — удаляются, — `reveal-on-peek`: сброс
      видимости/метки `peeked`.
- [ ] **Undo** (toast/баннер) доступен N минут; отменяет последний Restore.

**Тесты**

- [ ] Unit/Integration: корректность отката/Undo, синхронная пропагация в
      Flashcards/Reading/Translation.
- [ ] E2E: Restore → Undo → возврат исходного.

---

### 1.3 Контекстное меню Reading (ПКМ/long-press)

**Конфиг/схемы**

- [ ] `config/actions.json`: список пунктов. Поля: `id`, `enabled`, `titleKey`,
      `type: "openUrl"|"copy"`, `urlTemplate?`, `payloadKey?`, `target: "_blank"|"_self"`,
      `security: { allowedHosts: string[] }`.
- [ ] Плейсхолдеры: `%w` (слово), `%p` (фраза), `%b` (базовая форма), `%s` (предложение), `%sel`
      (выделение), `%lv` (source lang), `%tl` (target lang). Всегда применять **URI-encoding**.

**Компоненты**

- [ ] `ContextMenu` с триггерами `contextmenu` (desktop) и long-press (mobile); якорится к токену;
      **viewport-safe**.
- [ ] Открытие ссылок в `_blank` + `rel="noopener noreferrer"`; проверка домена по `allowedHosts`.
- [ ] Взаимодействие с tooltip: меню не должно перекрывать критичный контент; задержка tooltip не
      мешает меню.

**Тесты**

- [ ] Unit: сборка URL, белый список доменов, подстановка плейсхолдеров.
- [ ] E2E: ПКМ/long-press, корректная работа на мобильной ширине.

---

### 1.4 Политика видимости `reveal-on-peek`

**Конфиг**

- [ ] `flashcards.visibilityPolicy = "reveal-on-peek"`, `flashcards.peekHighlight`
      (класс/токен/opacity).

**Логика**

- [ ] Событие показа подсказки (после `reading.tooltip.showDelayMs`) → `visible=true` для карточки;
      проставить `peeked=true`.
- [ ] Постоянная подсветка `peeked` в Reading (стиль из конфига).
- [ ] Edit может массово менять видимость; ручные решения приоритетны.

**Persist/Export**

- [ ] Сохранение `visible/peeked` в сторе/экспорте; корректный ре-импорт.

**Тесты**

- [ ] E2E: до подсказки карточки скрыты; после подсказки — видны; подсветка `peeked` присутствует.

---

### 1.5 Stop-reasons UX (`max_tokens`)

**Фронт**

- [ ] Баннеры/индикаторы при `stop_reason: "max_tokens"`: — _Single_: кнопка **Повторить**
      (увеличить `max_tokens`). — _Batch_: **split-retry** для проблемных чанков; остальные
      результаты продолжают агрегацию.
- [ ] Журнал статусов (per-SID) в history/diagnostics.

**Прокси/адаптеры**

- [ ] Реализация bump/split-retry; уважать **Retry-After**; ретраи идемпотентны.
- [ ] Телеметрия (консоль/лог): счётчики stop-reasons, доля повторов/успехов.

**Тесты**

- [ ] Unit/Integration: сценарии с искусственным `max_tokens` (моки); подтверждение, что частичные
      успехи не теряются.
- [ ] E2E: пользователь видит баннер/Retry, после повтора данные «вклеиваются» по SID.

---

### 1.6 Документация/линт/качество

- [ ] Обновить `README.md` (указание JSONL импорта, контекстного меню, reveal-on-peek, stop-reasons
      UX).
- [ ] Доки конфигов: `/doc/configs/io.md`, `/doc/configs/actions.md`, обновления `flashcards.md`,
      `reading.md`.
- [ ] **AGENT.md / Codex.md / src/\*/AGENT.md**: добавить правила для JSONL, меню действий,
      reveal-on-peek, stop-reasons UX (без дублирования большого текста — ссылки на `tool-use.md`).
- [ ] Анти-хардкод-линт: утверждённые паттерны для URL-шаблонов/ключей/интервалов/код-путей.
- [ ] Версионирование схем/миграции при необходимости.

---

## 2) Спринты (предложенная последовательность)

### S10 — JSONL Import

Схемы/конфиги → потоковый парсер → превью diff/merge → e2e.

### S11 — Restore/Undo

BackupStore → UX Restore/Undo → интеграционные тесты.

### S12 — Reading Context Menu

`actions.json` + схема → компонент → плейсхолдеры/безопасность → unit+e2e.

### S13 — Reveal-on-Peek

События подсказки → изменение видимости/метки → persist/export → e2e.

### S14 — Stop-reasons UX

Баннеры/Retry → bump/split-retry в адаптерах → телеметрия → e2e.

### S15 — Docs & Polish

README/доки конфигов/AGENT/Codex → анти-хардкод → финальный QA.

---

## 3) Definition of Done (DoD)

- **JSONL Import**: валидные строки загружаются; невалидные аккуратно репортятся; merge-стратегии
  работают; ре-экспорт→ре-импорт восстанавливает состояние.
- **Restore/Undo**: полный откат к входному состоянию; Undo возвращает изменение; совместимость с
  политикой видимости.
- **Context Menu**: ПКМ/long-press; правильная подстановка плейсхолдеров; домены ограничены
  `allowedHosts`; не конфликтует с tooltip; i18n заголовки.
- **Reveal-on-Peek**: карточки становятся видимыми после подсказок; `peeked` подсвечены; правки в
  Edit имеют приоритет; состояние сохраняется в экспорт.
- **Stop-reasons UX**: баннеры/Retry показаны; bump/split-retry работает; частичные успехи не
  теряются; телеметрия фиксируется.
- **Документы/линт**: README/AGENT/Codex обновлены; конфиги задокументированы; хардкодов нет; все
  тесты зелёные.

---

## 4) Риски и меры

- **Крупные JSONL** → потоковый парсер, лимит `maxFileSizeMB`, прогресс-индикатор, отмена.
- **Безопасность меню** → строгий `allowedHosts`, URI-encoding плейсхолдеров, `_blank` + `noopener`.
- **Согласованность видимости** → единый источник (Store) + сериализация в экспорт; тесты на
  массовые операции.
- **Пользовательский опыт Retry** → чёткие баннеры, понятные кнопки, idempotency повторов, агрегация
  по **SID**.

---

## 5) Артефакты

- `doc/configs/io.md`, `doc/configs/actions.md`, обновлённые `flashcards.md`, `reading.md`.
- Примеры JSONL и скриншоты превью diff/merge.
- Образцы `actions.json` с готовыми шаблонами ссылок (Letonika, DeepL, …).
- Короткие сниппеты запросов и ответов с `tool_use` (ссылка на `doc/best_practices/tool-use.md`).
