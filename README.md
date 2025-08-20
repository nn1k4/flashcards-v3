# flashcards‑v3 — Latvian Language Learning (Web)

> React + TypeScript SPA with Node.js proxy. Config‑first architecture for learning Latvian through
> flashcards, reading tooltips, and robust batch processing via Claude API.

---

## ✨ Overview

- **Core flows:** Text → Flashcards → Reading → Translation → Edit.
- **Batch processing:** Anthropic _Message Batches_ with resilient UI/UX and offline JSONL import.
- **Config‑first:** all behavior (models, limits, keybindings, themes, i18n, delays, etc.) comes
  from configs — **no hardcoded values**.
- **Mobile‑first:** responsive UI, keyboard shortcuts on desktop, gesture‑ready design on mobile.
- **Future‑ready:** adapters for PDF/OCR/Images/Subtitles, Media follow‑highlight, TTS/Images, local
  NLP/MT, profiles & subscriptions.

> **Node.js:** v24.6.0 • **npm:** v11.5.1 • **Modules:** ESM

---

## 🗂️ Repository layout

```
flashcards-v3/
├─ doc/
│  ├─ plan/
│  │  ├─ plan_1.md       # MVP (v1)
│  │  ├─ plan_2.md       # v1.1 (JSONL, Restore/Undo, Context Menu, reveal-on-peek)
│  │  ├─ plan_3.md       # v1.2 (Ingestion: PDF/OCR/Images/Subtitles)
│  │  ├─ plan_4.md       # v1.3 (Media follow-highlight, Anki/Quizlet export)
│  │  └─ plan_5.md       # v2.0 (Profiles/Subscriptions/Local NLP/YouTube captions)
│  ├─ trs/
│  │  └─ trs_v_5.md      # Technical Requirements Specification (TRS v5.0)
│  ├─ roadmap/
│  │  └─ roadmap.md      # Consolidated roadmap across all stages
│  └─ best_practices/
│     ├─ best_practices0.md                # Modern Best Practices 2025 (React/TS/Node)
│     ├─ best_practices1.md                # Best practices in our stack (2025)
│     ├─ Message Batches.md                # How to use Message Batches API in React
│     ├─ MessageBatches2.md                # Parsing batch results in React
│     └─ TechnicalGuidesForClaudeAPIv2.0.md# Claude API v2.0 technical guide (highest priority after official docs)
│
├─ config/                 # JSON/TS configs (validated via Zod/JSON Schema)
├─ server/                 # Node.js ESM proxy (Express/Fastify)
├─ src/                    # React + TypeScript SPA
│  ├─ components/
│  ├─ hooks/
│  ├─ utils/
│  ├─ locales/            # i18n dictionaries: ru.json, uk.json, en.json, ...
│  └─ styles/
├─ public/
├─ AGENT.md                # Rules for AI-assisted coding in this repo
├─ Codex.md                # UI/UX and code style conventions
├─ package.json
└─ ...
```

---

## 🔌 Architecture

- **Frontend:** React 18 + TypeScript, Vite, Tailwind, Framer Motion (micro‑animations), Cypress
  (E2E).
- **Backend proxy:** Node 24 ESM, Express/Fastify; routes for health, single LLM calls, and _Message
  Batches_ (create/status/result).
- **Adapters:** `LLMAdapter` (Anthropic by default; OpenAI ready), `BatchAdapter`,
  `Pdf/Ocr/Image/Subtitle/Clipboard` adapters, `PlayerAdapter` (media), `TTSAdapter`/`ImageAdapter`
  (future), `Lemma/Dictionary/MT` (local NLP; future).
- **Stores:** Manifest (SID) → Card/Context stores; single source of truth for
  Flashcards/Reading/Translation/Edit.

---

## 🧩 App modes (MVP)

- **Text:** input area; toggle _Use batch processing_ → button label changes; _Get batch results_
  form (batch_id + history with “expired” mark after 29 days). Pre‑flight `/api/health` **before any
  start/load**.
- **Flashcards:** ←/→ navigate, Space/↑/↓ flip, `h` hide (not delete). Contexts: show N then “show
  more” up to M. Rounded corners + flip animation; fonts from config (`Noto Sans Display`).
- **Reading:** distinct highlights for **words** vs **phrases** + legend; **phrase wins** on
  overlap. Tooltip shows **surface form** translation; viewport‑aware positioning; optional delay
  (`tooltip.showDelayMs`), debounce, cancel on leave, single‑flight. (v1.1) Right‑click/long‑press
  context menu from config.
- **Translation:** bottom bar stats — words (UAX‑29), characters (graphemes), sentences (by SID),
  phrases (unique|occurrences) — all configurable.
- **Edit:** table with pagination; **VISIBLE** per card + **Master Visible** for all/filtered; edit
  base translation + context translations with **instant propagation** to all modes; “edit contexts
  (N)”; **Restore** (v1.1).

---

## ⚙️ Configuration policy (Config‑first)

- **No hardcoded values.** Everything is read from `/config/*.json` (or TS) validated by **Zod/JSON
  Schema** at startup (_fail‑fast_).
- **Decomposition:** domain‑specific files: `app.json`, `i18n.json`, `theme.json`, `network.json`,
  `llm.json`, `batch.json`, `flashcards.json`, `reading.json`, `translation.json`, `edit.json`,
  `io.json`, `ingestion/*.json`, `media.json`, `pipeline.json`, `nlp.json`.
- **Docs (RU):** each config has `/doc/configs/<name>.md` with purpose, keys, defaults, examples,
  dependencies, changelog, owner.
- **Index & generator:** `npm run docs:config` builds `CONFIG_INDEX.md`; `npm run validate:config`
  validates all configs.
- **Anti‑hardcode lint:** `npm run lint:anti-hardcode` fails PRs with model names, intervals,
  keycodes, etc. hard‑wired in code.

**Example snippets**

```jsonc
// config/flashcards.json
{
  "contextsDefault": 2,
  "contextsExpandLimit": 6,
  "keybinds": {
    "next": ["ArrowRight"],
    "prev": ["ArrowLeft"],
    "flip": ["Space", "ArrowUp", "ArrowDown"],
    "hide": ["h", "H"],
  },
  "ui": {
    "rounded": "2xl",
    "flipAnimationMs": 280,
    "flipEasing": "ease-in-out",
    "fontFamily": "Noto Sans Display",
  },
  "visibilityPolicy": "all-visible", // or "reveal-on-peek"
  "peekHighlight": { "class": "peeked", "colorToken": "accentMint", "opacity": 0.2 },
}
```

```jsonc
// config/reading.json
{
  "highlight": {
    "word": { "class": "word-underline", "colorToken": "accentYellow", "style": "dotted" },
    "phrase": { "class": "phrase-underline", "colorToken": "accentBlue", "style": "double" },
  },
  "tooltip": {
    "fontFamily": "Noto Sans Display",
    "opacity": 0.95,
    "maxWidth": 340,
    "mobileMaxWidth": "90vw",
    "offset": 8,
    "boundaryPadding": 8,
    "enterMs": 80,
    "leaveMs": 60,
    "showDelayMs": 0, // e.g. 3000 to reduce hover load
    "debounceMs": 100,
    "cancelOnLeave": true,
    "request": { "strategy": "afterDelay" },
  },
}
```

---

## 🛡️ Errors, health & batch behavior

- **Health pre‑flight:** front calls `/api/health` before any processing (single or batch). If proxy
  is down or network is unavailable, the **banner appears immediately**.
- **Status polling:** adaptive (1–2s → 3–5s → 10–30s → 30–60s) with jitter; proxy respects
  `Retry‑After` when polling Anthropic.
- **Handled codes:** `429` (rate limits), `413` (request too large), `500` (server error), `529`
  (overloaded). Clear, localized banners and retry/backoff policies.
- **Docs priority:** `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` is the **primary**
  internal guide; if it conflicts with `Message Batches.md`/`MessageBatches2.md`, follow v2.0 (and
  the official Anthropic docs).

---

## 🔁 Import / Export / Restore

- **Import:** `JSON` (full state with your edits) and `JSONL` (Anthropic Console batch results).
  Import UI shows diff preview and merge strategies:
  `replace-all | merge-keep-local | merge-prefer-imported`.
- **Export:** `JSON` snapshot including all edits and metadata (`appVersion`, `schemaVersion`,
  `exportedAt`, `locale`, `targetLanguage`). Future: **Anki/Quizlet** exporters.
- **Restore (Edit):** revert to the initial post‑processing state; optional local backup with _Undo_
  window.

---

## 🌐 i18n & Theming

- UI strings in `/src/locales/{ru,uk,en}.json`; fallback `en`.
- `i18n.targetLanguage` defines the target translation language (RU/UK/…); affects
  Flashcards/Reading/Translation **without code changes**.
- Themes: `light | dark | system` (respects `prefers-color-scheme`); design tokens via Tailwind/CSS
  variables.

---

## 🧪 Tests & quality

- **Unit:** tooltip controller (delay/cancel/single‑flight), text stats (Intl.Segmenter), reducers,
  JSONL parser & merge strategies, anti‑hardcode.
- **E2E:** UI happy paths (all modes), network/proxy failures, batch history, import/export/restore.
- **Lint:** ESLint + Prettier (or Biome). Preferred formatter output:
  **eslint-formatter-codeframe**.

Useful scripts:

```bash
npm run dev                 # start client + proxy (concurrently) in dev mode
npm run build               # build app
npm run start               # start production server
npm run lint -- --format codeframe
npm run test                # unit/integration
npm run e2e                 # Cypress
npm run validate:config     # Zod/JSON Schema validation for /config
npm run docs:config         # generate CONFIG_INDEX.md from schemas
```

---

## 🚧 Roadmap & plans

- High‑level: see **`doc/roadmap/roadmap.md`**.
- Stage plans: **`doc/plan/plan_1.md` … `plan_5.md`** (MVP → v2.0).
- TRS: **`doc/trs/trs_v_5.md`** — full, versioned technical requirements (source of truth for
  acceptance criteria).

---

## 🔒 Security & privacy

- API keys live on the **proxy** only; never ship keys to the browser.
- For future profiles/subscriptions: encrypted storage (AES‑GCM), HttpOnly tokens, CSRF protections,
  minimal logs.

---

## ♿ Accessibility

- Full keyboard navigation (focus rings, ARIA) across modes.
- High‑contrast variants via theming; tooltip/menu positioning respects viewport; mobile popovers.

---

## 🙌 Acknowledgements

- **Anthropic Claude** (Message Batches).
- **Helsinki‑NLP / TildeLM** (for future local MT path).
- **Latvian language community** and open‑source tools enabling segmentation and analysis.

---

## 📄 License

TBD (see `LICENSE`).

---

## 🗣️ Contributing

1. Read **`AGENT.md`** and **`Codex.md`** (coding rules, UI/UX conventions, config‑first policy).
2. Keep configs documented in **RU** under `doc/configs/*` and validated by Zod.
3. Ensure **no hardcoded values** (models, intervals, keycodes, font sizes, colors, chunk sizes,
   etc.).
4. Add/Update tests (unit + E2E) and run lint with **codeframe**.
5. Reference the relevant TRS acceptance criteria in your PR.

---

## 🧭 Quick start

```bash
# prerequisites: Node 24.6.0, npm 11.5.1

git clone https://github.com/nn1k4/flashcards-v3.git
cd flashcards-v3

cp .env.example .env             # set API base/keys for proxy if needed
npm ci

npm run validate:config          # ensure configs are valid
npm run dev                      # start client + proxy
# open http://localhost:5173 (default Vite)
```

> If you plan to use _Message Batches_, read `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md`
> first — it has **highest priority** (after the official Anthropic docs).
