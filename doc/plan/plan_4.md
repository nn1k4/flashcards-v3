# План реализации — Этап 4 (v1.3: Media follow-highlight + Export Anki/Quizlet)

Связка с ТЗ: **TRS v5.1** — §5.2/§5.3/§5.4 (режимы), §6 (импорт/экспорт), §12 (НФТ), §13
(Media/Player), §16 (конфиги), §17–§18 (приёмка/тесты), §20 («v1.3»). Приоритет доков: оф. Anthropic
→ `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` → `Message Batches.md` /
`MessageBatches2.md` → `tool-use.md`. Примечание: Этап не меняет **manifest/tool/batch** инварианты;
добавляет медиасинхронизацию и экспорт.

---

## 0) Цели этапа

- **Медиа-синхронизация**: воспроизведение аудио/видео, подсветка текущей фразы/слова в Reading
  (follow-highlight), переходы Text↔Media.
- **Управление**: хоткеи/жесты, pre/post-roll, плавный скролл; доступность и mobile-friendliness.
- **Экспорт колод**: форматы **Anki/Quizlet** (первая итерация — совместимые CSV/TSV/TSV-подобные),
  учёт N контекстов на обороте.
- **Config-first**: все параметры (медиа/экспорт/хоткеи) — только из конфигов; i18n; тесты.

---

## 1) Рабочие пакеты

### 1.1 Media Core (`PlayerAdapter`)

**Интерфейсы**

```ts
export interface MediaRef {
  id: string;
  type: 'audio' | 'video';
  src: string; // URL/Blob
  duration?: number;
  meta?: Record<string, unknown>;
}
export interface MediaAnchor {
  sid: string; // связь с Manifest
  startMs: number;
  endMs: number;
  confidence?: number;
}
export interface PlayerAdapter {
  mount(el: HTMLElement, ref: MediaRef): Promise<void>;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  currentTime(): number;
  on(event: 'timeupdate' | 'ended' | 'error', cb: (t: number) => void): void;
  destroy(): void;
}
```

**Реализация**

- [ ] HTML5 `<audio>/<video>` как базовый провайдер; HLS/DASH — по флагу (если включено в конфиге).
- [ ] События: `timeupdate` → диспетчер подсветки; `error` → локализованный баннер (код/совет).
- [ ] Конфиг `config/media.json` (Zod-схема):

```jsonc
{
  "provider": "html5",
  "preRollMs": 300,
  "postRollMs": 250,
  "throttleMs": 80,
  "debounceMs": 80,
  "followHighlight": true,
  "hotkeys": {
    "playPause": ["Space", "KeyK"],
    "backMs": 2000,
    "forwardMs": 2000,
    "prevSentence": ["ArrowUp"],
    "nextSentence": ["ArrowDown"],
  },
  "mobile": { "doubleTapMs": 2000, "edgeTapMs": 1000 },
}
```

### 1.2 Anchors & Follow-Highlight

- [ ] `MediaAnchorsStore` (SID → {startMs,endMs,confidence}). Источник — `manifest.meta.anchors` (из
      v1.2 Subtitles) или импортированный JSON.
- [ ] Маппинг времени → активный SID (binary search/upper bound).
- [ ] Подсветка в Reading: класс `reading.active` + плавный скролл к видимой области (respect user
      motion settings).
- [ ] Переходы:
  - из Reading: клик «▶ сегмент» → `playSegment(sid, pre/post-roll)`.
  - из плеера: вычислить ближайший SID и подсветить в Reading.

### 1.3 Управление (хоткеи/жесты/доступность)

- [ ] Хоткеи из `media.hotkeys`: Space/KeyK — play/pause; ←/→ — back/forward на N мс; ↑/↓ —
      prev/next sentence.
- [ ] Мобильные жесты: тап по левому/правому краю — ±N мс; двойной тап — play/pause (конфиг).
- [ ] A11y: управляемые кнопки с ARIA-лейблами, видимые focus-кольца, role="toolbar".
- [ ] i18n: все подписи/подсказки из `/src/locales/*`.

### 1.4 Интеграция в UI

- [ ] Раздел «Media» (inline/mini-player) + индикатор активного SID.
- [ ] В Reading: иконки «▶ сегмент» и «⤴ к медиамоменту» рядом с подсказкой/фразой; не
      конфликтовать с tooltip.
- [ ] В Flashcards (оборот): ссылка «воспроизвести контекст» (если есть anchor у `context.sid`).
- [ ] Перфоманс: throttle/debounce обновлений; опция отключить follow-highlight на слабых
      устройствах.

### 1.5 Экспорт Anki/Quizlet (v1)

**Конфиг**

```jsonc
{
  "io": {
    "export": {
      "formats": ["json", "anki", "quizlet"],
      "anki": { "deck": "LatvianDeck", "contextDelimiter": " — " },
      "quizlet": { "delimiter": "\t", "quote": "\"", "escape": "\\" },
      "backContexts": 2, // сколько контекстов на обороте
      "includeBaseForm": true,
    },
  },
}
```

**Маппинг полей**

- Front: латышская форма (слово/фраза).
- Back: базовый перевод + первые `backContexts` контекстов (латышский → перевод).
- Доп. колонки (опц.): `unit`, `base_form`.
- Экранирование: по конфигу (разделитель/кавычки/escape), Unicode безопасно.

**Форматы**

- [ ] **Anki**: TSV/CSV, совместимый с импортом (проверка в тестовом профиле).
- [ ] **Quizlet**: CSV/TSV (конфигурируемые разделители/кавычки).

**UX**

- [ ] Диалог «Экспорт»: выбор формата, параметров (N контекстов, включать `base_form` и пр.),
      предпросмотр 10 строк.
- [ ] Локализованные подсказки, заметки о лимитах целевого сервиса.

### 1.6 Документация/Линт/Качество

- [ ] RU-доки: `/doc/configs/media.md`, `/doc/configs/io.export.md` с примерами.
- [ ] Обновить **AGENT.md/Codex.md**: правила для PlayerAdapter, anchors, экспортёров (ссылаться, не
      дублировать).
- [ ] Анти-хардкод-линт: интервалы, хоткеи, разделители, имена колод — только из конфигов.
- [ ] Телеметрия (консоль/лог): `% media_timeupdate/s`, `seek_count`, `play_pause_count`,
      `export_count`.

---

## 2) Спринты

### S22 — Media Core

- PlayerAdapter (HTML5), события, конфиг; базовая панель управления; баннеры ошибок.

### S23 — Anchors & Follow-Highlight

- Store якорей, маппинг времени → SID, подсветка/скролл, переходы Text↔Media.

### S24 — Управление и интеграция

- Хоткеи/жесты/a11y; встраивание в Reading/Flashcards; перф-тюнинг.

### S25 — Экспорт Anki/Quizlet

- Маппинг/формирование файлов; диалог настроек; предпросмотр; ручная проверка импорта.

### S26 — Docs & Polish

- RU-доки, локализация, анти-хардкод; unit/integration/E2E; стабилизация.

---

## 3) Definition of Done (DoD)

- Плеер (audio/video) управляется (play/pause/seek/back/forward), ошибки воспроизведения
  показываются баннерами.
- Follow-highlight: активная фраза/слово подсвечивается; клик по тексту играет нужный сегмент с
  pre/post-roll; плавный скролл.
- Хоткеи и мобильные жесты работают, настраиваются конфигом; доступность соблюдена.
- Экспорт Anki/Quizlet выдаёт корректные файлы (экранирование/кодировка/колонки/кол-во контекстов);
  пробный импорт успешен.
- **Config-first**: ни одного хардкода интервалов/горячих клавиш/разделителей; валидация Zod
  зелёная.
- Тесты (unit/integration/E2E) зелёные; документация обновлена.

---

## 4) Риски и меры

- **Неточные тайминги/разметка** → nearest-SID, pre/post-roll, визуальные допуски; будущая ручная
  коррекция якорей.
- **Мобильные ограничения автоплея** → запуск только по пользовательскому действию; явные подсказки
  в UI.
- **Перфоманс подсветки** → throttle/debounce/disable-flag; минимизация reflow.
- **Совместимость форматов экспорта** → строгие тесты на экранирование/разделители; инструкции по
  импорту; опция альтернативных кодировок (UTF-8 BOM).
- **A11y/i18n** → полный набор локализаций и ARIA-атрибутов, фокус-контуры.

---

## 5) Артефакты

- `/doc/configs/media.md`, `/doc/configs/io.export.md` (RU) с примерами конфигов и скриншотами.
- Образцы экспортируемых файлов для Anki/Quizlet + чек-лист ручной проверки.
- Диаграмма взаимодействия Player ↔ Reading (Mermaid) в `doc/architecture_media.mmd`.
