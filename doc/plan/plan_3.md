# План реализации — Этап 3 (v1.2: Ingestion — PDF/OCR/Images/Subtitles)

Связка с ТЗ: **TRS v5.1** — §4 (pipeline), §6 (импорт/экспорт), §12 (НФТ), §13 (интеграции), §16
(конфиги), §17–§18 (приёмка/тесты), §20 («v1.2»). Приоритет доков: оф. Anthropic →
`doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` → `Message Batches.md` /
`MessageBatches2.md` → `tool-use.md`. Примечание: Этап **не меняет**
manifest-/tool-/batch-инварианты — ingestion лишь расширяет источники текста и выдаёт **тот же**
детерминированный Manifest/SID.

---

## 0) Цели этапа

- Добавить источники помимо ручной вставки: **PDF → текст/или OCR**,
  **изображения/скриншоты/Clipboard → OCR**, **субтитры (SRT/VTT/ASS)**.
- Обеспечить единый выход: **Manifest (SID)**, совместимый с текущим пайплайном (сегментация →
  LLM/tool-use → агрегация по SID).
- UX: единый диалог импорта, drag\&drop, прогресс, понятные ошибки, mobile-first,
  lazy-chunks/worker’ы.
- Соблюсти **config-first**/Zod-валидацию, отсутствие хардкодов и полную локализацию UI.

Не входят: медиаплеер и follow-highlight (v1.3), YouTube-капшены/профили/подписки (v2.0).

---

## 1) Рабочие пакеты

### 1.1 Архитектура Ingestion

- [ ] **IngestionManager** — единая точка входа, маршрутизация по источнику/MIME/расширению.
- [ ] Общий интерфейс адаптера:

  ```ts
  interface IngestResult {
    manifest: Manifest; // итог для пайплайна
    meta: Record<string, unknown>; // источник, язык, файлы, предупреждения
    warnings?: string[];
    stats?: { elapsedMs?: number; items?: number; ocrUsed?: boolean };
  }
  interface IngestAdapter {
    canHandle(input: Input): boolean;
    ingest(input: Input, cfg: Cfg): Promise<IngestResult>;
  }
  ```

- [ ] **Lazy**: `PdfAdapter`, `OcrAdapter` (tesseract/wasm), `ImageAdapter`, `SubtitleAdapter`,
      `ClipboardAdapter` — динамические чанки.
- [ ] **Web Worker** для OCR/тяжёлых парсеров; ограничение параллельности.
- [ ] Конфиги + схемы Zod: `ingestion/pdf.json`, `ingestion/ocr.json`, `ingestion/images.json`,
      `ingestion/subtitles.json`, `ingestion/clipboard.json`.

### 1.2 PDF

- [ ] Извлечение текста из текстового слоя (если есть); иначе — **fallback на OCR** страниц.
- [ ] Конфиги: `supportedMime`, `maxPages`, `maxFileSizeMB`, `extractMeta` (title/author/lang),
      `normalizeNewlines`.
- [ ] Метаданные в `manifest.meta.source.pdf` (страницы, язык, предупреждения).
- [ ] Юнит-тесты: PDF с текстом/без текста; превышение лимитов; корректная нормализация и мета.

### 1.3 OCR (PDF/Images)

- [ ] **Tesseract (wasm)**: `langs[]`, `psm`, `dpi`, `denoise`, `binarize`, `timeoutMs`,
      `parallelism`.
- [ ] Выход: нормализованный текст (опционально bbox на будущее, без рендера сейчас).
- [ ] Пакетная обработка страниц/файлов, прогресс-коллбеки, отмена задач.
- [ ] Юнит-тесты: моки OCR, таймауты/отмена, деградация качества, подсчёт времени.

### 1.4 Изображения/Clipboard

- [ ] Drag\&drop и вставка из Clipboard (`image/*`): превью, фильтрация `png,jpg,jpeg,webp`, предел
      `maxFileSizeMB`.
- [ ] Несколько изображений → объединяем в единый Manifest в порядке страниц/добавления.
- [ ] Баннеры при невалидных форматах/слишком больших файлах; локализация.

### 1.5 Субтитры (SRT/VTT/ASS)

- [ ] Парсеры: построчно → `{ text, tStart, tEnd }` с нормализацией переносов и очисткой HTML/тегов
      стилей.
- [ ] Выбор дорожки/языка (если несколько); авто-детект с подсказкой.
- [ ] Mapping в **SID** по порядку; таймкоды в `manifest.meta.anchors` для последующей синхронизации
      (v1.3).
- [ ] Юнит-тесты: edge-кейсы таймкодов, пустые строки, BOM, разметка ASS.

### 1.6 UI/UX Ingestion

- [ ] Единый **диалог импорта** (табы): **PDF / Image / Subtitles / Clipboard / Text**.
- [ ] Прогресс-индикаторы (per-item/overall), итоговый отчёт (успешно/пропущено/ошибки).
- [ ] Mobile-first: крупные таргеты, отсутствие drag-only критических действий; доступность ARIA.
- [ ] i18n-строки: заголовки, описания лимитов, статусы, предупреждения.

### 1.7 Интеграция с пайплайном

- [ ] IngestResult → **сегментация `latvian_sentence_tester:local`** → Manifest/SID → остальной
      пайплайн без изменений.
- [ ] Соблюдать текущие лимиты (`1 предложение/чанк`, `~300 токенов`) из конфигов; никаких
      хардкодов.
- [ ] Не нарушать **tool-use/manifest/batch** инварианты (см. TRS §4.3/§7): downstream логика
      остаётся прежней.

### 1.8 Конфиги/схемы/пример

- [ ] Примеры (doc/configs):

  ```jsonc
  // ingestion/pdf.json
  {
    "supportedMime": ["application/pdf"],
    "maxPages": 200,
    "maxFileSizeMB": 50,
    "extractMeta": true,
    "normalizeNewlines": true,
    "ocrFallback": true
  }
  // ingestion/ocr.json
  {
    "langs": ["lav","eng"],
    "psm": 3,
    "dpi": 300,
    "denoise": true,
    "binarize": true,
    "timeoutMs": 180000,
    "parallelism": 2
  }
  // ingestion/images.json
  { "allowed": ["png","jpg","jpeg","webp"], "maxFileSizeMB": 20 }
  // ingestion/subtitles.json
  {
    "allowed": ["srt","vtt","ass"],
    "normalizeNewlines": true,
    "stripHtml": true,
    "preferTrackLang": ["lv","lav","ltg","en"]
  }
  ```

- [ ] Схемы Zod; `npm run validate:config` — зелёный.

---

## 2) Спринты (продолжение нумерации)

### S16 — Каркас и конфиги

IngestionManager, интерфейсы адаптеров, базовые конфиги/схемы, lazy-chunks, worker-каркас.

### S17 — PDF + OCR fallback

Извлечение текста, fallback на OCR, лимиты/метаданные, юнит-тесты.

### S18 — Images/Clipboard → OCR

DnD/Clipboard, многокадровый импорт, прогресс/отмена, юнит-тесты OCR-потока.

### S19 — Subtitles (SRT/VTT/ASS)

Парсеры, выбор дорожки/языка, anchors в manifest.meta, юнит-тесты.

### S20 — UI/UX диалог + интеграция

Единый диалог импорта, прогресс/отчёты, локализация, связка с сегментацией → общий pipeline; E2E.

### S21 — Docs & Polish

RU-доки конфигов, шлифовка валидаторов, перф/память (параллелизм OCR), итоговые E2E.

---

## 3) Definition of Done (DoD)

- Любой источник (**PDF/Image/Clipboard/Subtitles**) формирует корректный **Manifest (SID)**,
  совместимый с текущим пайплайном.
- PDF с текстовым слоем не уходит в OCR; при его отсутствии надёжно включается fallback;
  лимиты/ошибки локализованы.
- OCR обрабатывает партии страниц/файлов с ограничением параллельности; есть прогресс и отмена.
- Subtitles парсятся с таймкодами/дорожками и мапятся в SID; anchors доступны в `manifest.meta`.
- Диалог импорта удобен на desktop/mobile; показ прогресса/варнингов/ошибок ясен.
- **Config-first**: все параметры — из конфигов (Zod зелёный); хардкодов нет.
- Все E2E сценарии импорта → сегментации → дальнейшей обработки проходят.

---

## 4) Риски и меры

- **Производительность OCR** → web-workers, лимит параллелизма, прогресс/отмена, рекомендации в UI.
- **Качество OCR** → настраиваемые `langs/psm/dpi/denoise/binarize`; варнинги качества; возможность
  повторного прогона.
- **Разнородность субтитров** → tolerant-парсеры, нормализация переносов/тегов, логи проблемных
  строк.
- **Память/большие файлы** → потоковая обработка/чанкинг, `maxFileSizeMB`, аккуратные ошибки и
  советы.
- **Локализация/доступность** → полный набор i18n-ключей, fallback `en`, ARIA-роли для диалога.

---

## 5) Артефакты

- `doc/configs/ingestion.pdf.md`, `ingestion.ocr.md`, `ingestion.images.md`,
  `ingestion.subtitles.md`, `ingestion.clipboard.md` (RU; примеры и лимиты).
- Примеры импортируемых файлов (PDF/изображения/SRT/VTT/ASS) и скриншоты диалога импорта.
- Чек-листы приёмки: соответствие Manifest/SID, корректность anchors, поведение лимитов/ошибок.
