# Components Agent Guide — `src/components` (v5.1)

> Инструкция для ИИ-помощников и разработчиков, работающих с UI-слоем. Цель — **не нарушать
> архитектурные инварианты**, следовать **TRS/планам**, и обеспечивать предсказуемый UX.

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Plans: `doc/plan/plan_1.md … plan_5.md`
- Best Practices: `doc/best_practices/*` (приоритет: `TechnicalGuidesForClaudeAPIv2.0.md`,
  `tool-use.md`)
- Общие правила для ИИ: `AGENT.md`, UI/UX нормы: `Codex.md`

> Любая правка компонентов должна ссылаться на соответствующие пункты TRS/плана в PR.

---

## 0) Базовые нормы

- **Функциональные компоненты + TS.** Без классовых.
- **Чистый UI:** побочные эффекты (HTTP/таймеры/обработчики) — **только в hooks**. Компоненты не
  держат собственных async-состояний.
- **Никаких прямых API-вызовов** из компонентов → используйте `src/hooks/*`/`api/client.ts`.
- **Порядок предложений не трогаем:** приходит из **Manifest/SID**.
- **Props строго типизированы**; никаких «широких» `any/unknown` без сузителей.
- **Стабильные key** в списках: `card.id`/`SID`, а не индекс.
- **Мемоизация:** `React.memo`/`useMemo`/`useCallback` по необходимости, без преждевременной
  оптимизации.
- **Error Boundaries + Suspense/скелетоны** на границах данных/тяжёлых фич.
- **Тестирование через React Testing Library** (поведение, не имплементация).
- **i18n:** только `t('…')`; сырых строк нет.
- **Темы/стили:** Tailwind + CSS vars; токены/значения — из конфигов (без magic numbers).
- **Доступность:** aria-атрибуты, видимый фокус, корректный tab-order.
- **Config-first:** всё через `useConfig()`/контекст; **никаких хардкодов**.
- **Ошибки — сразу пользователю:** баннеры/тосты (см. §5), консоль вторична.

---

## 1) Дерево и ответственность

```
src/components/
  Text/            # ввод, batch-переключатель, загрузка batch
  Flashcards/      # колода, карточка, контексты, хоткеи
  Reading/         # подсветка слов/фраз, тултипы, контекстное меню
  Translation/     # панель перевода + статистика
  Edit/            # таблица, правка переводов, master visible, restore
  ImportExport/    # импорт JSON/JSONL, превью diff, merge-стратегии
  Banners/         # error/info баннеры; размещение под контролами
  Media/           # (v1.3) плеер, follow-highlight
  Common/          # пагинация, диалоги, легенды, иконки
```

**Слои:** компоненты — презентация; бизнес-логика/эффекты → `hooks`; состояние → `stores` (вне
`components`).

---

## 2) Компоненты режимов (MVP)

### 2.1 `Text` (ввод и batch)

**Состав:** `TextInputPanel`, `BatchToggle`, `BatchStartButton`, `BatchResultLoader`,
`BatchHistoryList`, `HealthGuard`. **Поведение:**

- Переключатель **«Использовать пакетную обработку»** меняет лейбл кнопки на **«Начать пакетную
  обработку»**.
- При включении — форма **«Получить результаты batch»** (поле `batch_id`, «Загрузить», история,
  отметка **просрочено** ≥29 дней).
- Перед любым стартом/загрузкой — `HealthGuard` вызывает `/api/health`; при недоступности
  прокси/сети → **немедленный баннер** (размещается под переключателем). **Конфиги:** лимит длины,
  политика истории, таймауты health-check. **A11y:** `aria-describedby` для лимитов/ошибок;
  таб-порядок.

### 2.2 `Flashcards`

**Состав:** `Deck`, `Card`, `ContextList`, `CardNav`, `CardToolbar`. **Поведение:**

- Хоткеи: `ArrowLeft/Right` — навигация; `Space|ArrowUp|ArrowDown` — flip; `h` — скрыть карточку.
- Переход к другой карточке всегда открывает **front**.
- Контексты: показывать `N`, «Показать больше» до `M` (оба из конфигов).
- Подсветка целевой формы внутри контекста. **UI:** закругления, анимация flip (Framer Motion),
  шрифт **Noto Sans Display** — из конфигов. **Видимость:** соблюдаем
  `all-visible`/`reveal-on-peek`; показываем класс/иконку `peeked`.

### 2.3 `Reading`

**Состав:** `ReadingView`, `Legend`, `TooltipAnchor`, `ContextMenu` (v1.1), `HintStats` (опц.).
**Поведение:**

- Подсветка **слов** и **фраз** разными стилями; при пересечении **фраза приоритетна**. Легенда
  обязательна.
- Tooltip: **surface-форма** + перевод; позиционирование в пределах viewport; mobile —
  popover/bottom-sheet.
- Производительность: `tooltip.showDelayMs` (по умолчанию 0, может быть 3000), `debounceMs`,
  `cancelOnLeave`, **single-flight**; до истечения delay **не** делать запрос.
- (v1.1) ПКМ/long-press **контекстное меню** из `config/actions.json` с плейсхолдерами
  `%w/%p/%b/%s/%sel/%lv/%tl` и white-list доменов.
- (опц.) hover-TTS — по флагу в конфиге. **Видимость (reveal-on-peek):** после успешного tooltip
  карточка становится `visible=true`, токен помечается `peeked`.

### 2.4 `Translation`

**Состав:** `TranslationPanel`, `StatsBar`. **Статистика:** слова (UAX-29), символы (графемы),
предложения (SID), фразы (unique|occurrences) — параметры из конфигов, считаем через
`Intl.Segmenter`.

### 2.5 `Edit`

**Состав:** `CardTable`, `SearchBar`, `MasterVisibleToggle`, `EditContextsModal`, `RestoreButton`.
**Поведение:**

- `VISIBLE` на строке; **Master Visible** — массово (все/фильтр).
- Правка **базового перевода** и **переводов контекстов** с **мгновенной** пропагацией в
  Flashcards/Reading/Translation.
- «Править контексты (N)» — модал/таблица; добавление/удаление/правка переводов.
- **Restore** — откат к состоянию «после первичной обработки»; если включён бэкап — `Undo` в окне
  времени. **Пагинация:** `pageSize` из конфигов; индикатор количества.

### 2.6 `ImportExport`

**Состав:** `ImportDialog`, `ExportDialog`, `DiffPreview`, `StrategyChooser`. **Импорт:**

- `JSON` — полный снапшот с вашими правками → превью diff → стратегии
  `replace-all | merge-keep-local | merge-prefer-imported` (дефолт — из конфигов).
- `JSONL` (Anthropic Console) — потоковый парсер, агрегация по `custom_id==SID`, отчёт
  imported/skipped/invalid; офлайн-валиден после 29 дней. **Экспорт:** `JSON` (+ метаданные
  `appVersion`, `schemaVersion`, `exportedAt`, `locale`, `targetLanguage`). (v1.3) Экспорт
  Anki/Quizlet.

### 2.7 `Banners`

**Состав:** `ErrorBanner`, `InfoBanner`, `RetryHint`. **Коды:** `429/413/500/529`, expired batch,
нет сети/прокси down. Локализованные тексты + советы (respect `Retry-After`). **Размещение:** в зоне
видимости пользователя, **под** переключателем batch (требование UX и TRS).

### 2.8 `Media` (v1.3)

**Состав:** `MiniPlayer`, `MediaControls`, `FollowIndicator`. **Связки:** `PlayerAdapter` (HTML5),
follow-highlight (подсветка текущего SID в Reading), переходы «фраза/слово → медиасегмент» и
обратно.

---

## 3) i18n, тема, конфиги

- Все тексты — из `/src/locales/*`, fallback `en`.
- Темы: `light|dark|system` (Tailwind токены, CSS vars).
- Значения поведения/лимитов (N/M, задержки, хоткеи, размеры) — из `/config/*.json` (валидация Zod).
- Анти-хардкод — активен в CI; не прошедшие PR блокируются.

---

## 4) Ошибки и статус-UX

- `Text`: перед стартом single/batch и «Загрузить» — **pre-flight `/api/health`**; негативные пути →
  **немедленные баннеры**.
- `BatchResultLoader`/`BatchHistoryList`: те же баннеры при выключенном прокси/нет сети/**expired**.
- `Reading`: отменять in-flight tooltip-запросы при `mouseleave`/unmount; не инициировать запрос до
  `showDelayMs`.
- Отдельные баннеры для **stop_reason: "max_tokens"** (см. `tool-use.md`): показать рекомендацию
  «Повторить»/split-retry (кнопки из hooks).

---

## 5) Доступность и клавиатура

- Видимый фокус, aria-метки, корректные роли (`button`, `dialog`, `list`, `menu`).
- Хоткеи Flashcards и (v1.3) Media активны только при фокусе соответствующего контейнера.
- Легенда подсветок в Reading; скринридер-тексты на иконках/кнопках.

---

## 6) Производительность

- Виртуализация больших списков (Edit/Deck) по необходимости.
- Lazy-chunks для тяжёлых модулей (ImportDialog/JSONL parser/Media).
- Селекторы/мемоизация, минимизация перерисовок.
- Tooltip: `request.strategy="afterDelay"`, debounce, single-flight.

---

## 7) Тестирование компонентов

- **RTL unit/integration:** хоткеи, flip, подсветки, позиционирование tooltip, дифф-превью.
- **Cypress E2E:** happy-path каждого режима; ошибки сети/прокси; batch-история; import/export;
  reveal-on-peek; контекстное меню.
- **Golden:** порядок отображения по SID; Export→Re-import даёт идентичное состояние.

---

## 8) Примеры

**Навигация карточек (идея):**

```tsx
function CardNav() {
  const cfg = useConfig().flashcards;
  const { next, prev } = useDeckNav();
  useHotkeys({
    [cfg.keybinds.next.join(',')]: next,
    [cfg.keybinds.prev.join(',')]: prev,
  });
  return (
    <div className="flex items-center gap-2">
      <Button onClick={prev} aria-label={t('flash.prev')}>
        ←
      </Button>
      <Button onClick={next} aria-label={t('flash.next')}>
        →
      </Button>
    </div>
  );
}
```

**Показ контекстов с «Ещё»:**

```tsx
function ContextList({ contexts }: { contexts: Ctx[] }) {
  const { contextsDefault, contextsExpandLimit } = useConfig().flashcards;
  const [limit, setLimit] = useState(contextsDefault);
  const shown = contexts.slice(0, limit);
  return (
    <div>
      {shown.map((c) => (
        <ContextItem key={c.sid} ctx={c} />
      ))}
      {contexts.length > limit && limit < contextsExpandLimit && (
        <Button onClick={() => setLimit(Math.min(contexts.length, contextsExpandLimit))}>
          {t('flash.showMore')}
        </Button>
      )}
    </div>
  );
}
```

---

## 9) Чек-лист перед PR

- [ ] Все строки через i18n; тема соблюдена.
- [ ] Нет хардкодов; все значения — из конфигов.
- [ ] Баннеры ошибок выводятся для всех негативных путей (в т.ч. health/batch/expired/max_tokens).
- [ ] Хоткеи и фокус работают; a11y проверен.
- [ ] Компоненты **без** бизнес-логики/эффектов (они в hooks).
- [ ] Unit/E2E тесты добавлены/обновлены; golden при необходимости.
- [ ] Ссылки на § TRS/plan пункты указаны в PR.
