# Components Agent Guide — `src/components`

> Этот файл предназначен для ИИ‑помощников и разработчиков, работающих c UI‑слоем. Следуйте
> правилам, чтобы **не нарушать архитектуру, инварианты и приёмочные критерии** из TRS.

## 0) Канон ссылок

- TRS: `doc/trs/trs_v_5.md`
- Roadmap: `doc/roadmap/roadmap.md`
- Plans: `doc/plan/plan_1.md … plan_5.md`
- Best Practices: `doc/best_practices/*` (приоритет `TechnicalGuidesForClaudeAPIv2.0.md`)
- Общие правила для ИИ: `AGENT.md`, UI/UX: `Codex.md`

> Любая правка компонентов должна ссылаться на соответствующие пункты TRS/плана в PR.

---

## 1) Общие нормы для компонентов

- **Функциональные компоненты** + TypeScript. Без классовых компонентов.
- **Чистые компоненты**: побочные эффекты только в hooks; UI = функция от props/state.
- **Компоненты не имеют собственного async‑состояния**; любая асинхронщина
  (HTTP/таймеры/обработчики) — **только в hooks**.
- **Запрещены прямые вызовы API из компонентов**; используйте `src/hooks/*`/`api/client.ts` и
  конфиги.
- **Никаких прямых манипуляций порядком предложений**; порядок приходит из **Manifest/SID**.
- **Props строго типизированы**; `any/unknown` — только с явной узкой проверкой; описывать `Props`
  рядом с компонентом.
- **Стабильные ключи** списков: `id` карточки/SID, не индексы.
- **Мемоизация**: `React.memo`, `useMemo`, `useCallback` где уместно; без преждевременной
  оптимизации.
- **Error Boundaries обязательны** на границах загрузки данных/фич; `Suspense`/скелетоны для
  ожидания.
- **Тестирование компонентов — через React Testing Library** (ориентация на пользовательское
  поведение).
- **i18n**: строки только через `t('…')`; никаких сырых строк.
- **Темы/стили**: Tailwind + CSS vars; без инлайновых «магических» значений; все токены из
  темы/конфигов.
- **Доступность**: aria‑атрибуты, видимый фокус, управление клавиатурой.
- **Конфиги**: значения из `useConfig()`/контекста; **никаких хардкодов**.
- **Ошибки** пользователю показываются **немедленно** баннерами/тостами (см. §5), а не только в
  консоли.

---

## 2) Дерево и ответственность

```
src/components/
  Text/            # ввод текста, batch‑переключатель, форма загрузки batch
  Flashcards/      # колода, карточка, контексты, хоткеи
  Reading/         # подсветка слов/фраз, тултипы, контекстное меню
  Translation/     # панель перевода и статистика
  Edit/            # таблица карточек, правка переводов, master visible, restore
  ImportExport/    # импорт/экспорт JSON/JSONL, превью diff, стратегии merge
  Banners/         # error/info баннеры, маппинг кодов, расположение под контролами
  Media/           # (v1.3) мини‑плеер, кнопки управления, follow‑highlight
  Common/          # пагинация, диалоги, легенды, иконки
```

**Разделение слоёв:**

- Компоненты = презентационный слой. Бизнес‑логика/эффекты → `src/hooks/*`.
- Состояния/хранилища → `stores` (вне `components`). Компоненты получают селекторы/действия через
  hooks.

---

## 3) Компоненты режимов (MVP)

### 3.1 `Text` (ввод и batch)

- Состав: `TextInputPanel`, `BatchToggle`, `BatchStartButton`, `BatchResultLoader`,
  `BatchHistoryList`, `HealthGuard`.
- Поведение:
  - Переключатель **«Использовать пакетную обработку»** меняет лейбл кнопки на **«Начать пакетную
    обработку»**.
  - При включённой галочке появляется форма **«Получить результаты batch»** (поле `batch_id`, кнопка
    «Загрузить», история `batch_id` с пометкой **просрочено** после 29 дней).
  - **Перед запуском** одиночной/пакетной обработки и перед «Загрузить» — `HealthGuard` вызывает
    `/api/health`; при недоступности → немедленный баннер в `Banners`.

- Конфиги: лимиты длины текста, политика истории, таймауты health‑check.
- A11y: `aria-describedby` для лимитов/ошибок; клавиатурная доступность переключателя.

### 3.2 `Flashcards`

- Состав: `Deck`, `Card`, `ContextList`, `CardNav`, `CardToolbar`.
- Поведение:
  - Хоткеи: `ArrowLeft/ArrowRight` — навигация; `Space|ArrowUp|ArrowDown` — flip; `h` — скрыть
    карточку.
  - При переходе на другую карточку **всегда** стартуем с **front**.
  - Контексты: отображать `N` по умолчанию; «Показать больше» до `M`. Значения из конфигов.
  - Подсветка целевой формы в контекстах.

- UI: плавная flip‑анимация (Framer Motion), закругления, шрифт **Noto Sans Display** из конфигов.
- Видимость: политика `all-visible`/`reveal-on-peek` соблюдается; иконка/класс `peeked`.

### 3.3 `Reading`

- Состав: `ReadingView`, `Legend`, `TooltipAnchor`, `ContextMenu` (v1.1), `HintStats` (опц.).
- Поведение:
  - Подсветки: **слова** (стиль A) и **фразы** (стиль B). При пересечении активна **фраза**.
  - Tooltip показывает **surface‑форму** + перевод, позиционируется без выхода за viewport (mobile:
    bottom‑sheet).
  - Производительность: `showDelayMs`, `debounceMs`, `cancelOnLeave`, **single‑flight**; до
    истечения delay **не** выполнять запросы.
  - (v1.1) ПКМ/long‑press **контекстное меню** из `config/actions.json` с плейсхолдерами
    `%w/%p/%b/%s/%sel/%lv/%tl` и white‑list доменов.
  - (Опц.) hover‑TTS — флаг в конфиге.

- Видимость: в `reveal-on-peek` успешный tooltip делает карточку видимой, а токен — подчеркнутым
  `peeked`.

### 3.4 `Translation`

- Состав: `TranslationPanel`, `StatsBar`.
- Статистика: слова (UAX‑29), символы (графемы), предложения (SID), фразы (unique|occurrences).
  Использовать `Intl.Segmenter`.

### 3.5 `Edit`

- Состав: `CardTable`, `SearchBar`, `MasterVisibleToggle`, `EditContextsModal`, `RestoreButton`.
- Поведение:
  - `VISIBLE` для карточки; **Master Visible** — массово для всех/фильтра.
  - Правка **базового перевода** и **переводов контекстов** с мгновенной пропагацией в
    Flashcards/Reading/Translation.
  - «Править контексты (N)» — модал/таблица; удаление/добавление контекстов.
  - **Restore** — откат к состоянию «после первичной обработки»; (если включён бэкап) поддержать
    `Undo` в окне времени.

- Пагинация: `pageSize` из конфигов; индикатор общего числа карт/фильтра.

### 3.6 `ImportExport`

- Состав: `ImportDialog`, `ExportDialog`, `DiffPreview`, `StrategyChooser`.
- Импорт: `JSON` (полный снапшот) и `JSONL` (Anthropic Console) — потоковый парсер, агрегация по
  `custom_id==SID`, отчёт по ошибкам.
- Экспорт: `JSON` (метаданные app/schema/locale/targetLanguage). (v1.3) Экспорт Anki/Quizlet.

### 3.7 `Banners`

- Состав: `ErrorBanner`, `InfoBanner`, `RetryHint`.
- Коды: `429/413/500/529`, expired batch, недоступность прокси/сети. Локализованные тексты и советы
  (respect `Retry‑After`).
- Размещение: в зоне видимости пользователя, **под** переключателем batch (как требование UX).

### 3.8 `Media` (v1.3)

- Состав: `MiniPlayer`, `MediaControls`, `FollowIndicator`.
- Связь: `PlayerAdapter` (см. plan_4.md), подсветка текущего SID в Reading, переход «слово/фраза →
  сегмент» и обратно.

---

## 4) i18n, тема, конфиги

- Все тексты — из `/src/locales/*`. Fallback — `en`.
- Темы: `light|dark|system`; классы Tailwind с токенами.
- Значения поведения/лимитов (N/M, задержки, хоткеи, размеры) — из `/config/*.json` (валидация Zod).
  **Никаких хардкодов.**

---

## 5) Ошибки и UX статусов

- Pre‑flight `/api/health` в `Text` перед любой операцией; негативные пути → баннеры в `Banners`.
- В `BatchResultLoader`/`BatchHistoryList` те же баннеры при выключенном прокси/нет сети/expired.
- В `Reading` отменять in‑flight tooltip‑запросы при `mouseleave`/unmount.

---

## 6) Доступность и клавиатура

- Фокус‑кольца, aria‑метки, роли (кнопки/списки/диалоги), логичный таб‑порядок.
- Хоткеи Flashcards и (v1.3) Media — активны только когда компонент в фокусе; озвучивание для
  экранных читалок.

---

## 7) Производительность

- Виртуализация больших списков (Edit/Deck) при необходимости.
- Lazy‑chunks для тяжёлых модулей (ImportDialog/JSONL parser/Media).
- `useMemo`/`memo`/селекторы; минимизация перерисовок.

---

## 8) Тестирование компонентов

- **React Testing Library** для unit/integration рендера и поведения (хоткеи, flip, подсветки,
  позиционирование tooltip, дифф‑превью).
- **E2E (Cypress)**: happy‑path для каждого режима; ошибки сети/прокси; batch‑история;
  import/export; reveal‑on‑peek; контекстное меню.
- **Golden**: инварианты порядка отображения по SID.

---

## 9) Примеры

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

## 10) Чек‑лист перед PR

- [ ] Все строки через i18n; тема соблюдена.
- [ ] Нет хардкодов; значения — из конфигов.
- [ ] Баннеры ошибок выводятся для всех негативных путей.
- [ ] Хоткеи и фокус работают; a11y проверен.
- [ ] Компоненты не содержат бизнес‑логики/эффектов (они в hooks).
- [ ] Unit/E2E тесты добавлены/обновлены; golden при необходимости.
- [ ] Ссылки на TRS/plan пункты добавлены в PR.
