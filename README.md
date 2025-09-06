# flashcards-v3 — Latvian Language Learning (Web)

✨ **Flashcards-v3** is a smart online assistant for learning Latvian. Paste any text — and the app
will automatically turn it into handy flashcards with translations, hints, and contexts.

📖 Read texts with instant word and phrase translations, practice with flashcards, track your
statistics, and edit translations to your liking. 📦 Save your progress and export flashcards to
Anki or Quizlet. 🎧 Coming soon — study with video and audio: words highlighted in sync with speech.

**Flashcards-v3** makes language learning lively and engaging: don’t just memorize isolated words,
learn from real texts that interest you.

---

> React + TypeScript SPA with a Node.js proxy. **Config-first**, **manifest-oriented** architecture
> for learning Latvian through flashcards, reading tooltips, and robust batch processing with
> Claude. **LLM integration:** JSON-only via **Claude tools** (+ Zod), **prompt caching** for stable
> blocks, resilient handling of **stop reasons** (incl. `max_tokens`).

---

## ✨ What this project is

- **Core flow:** Text → Flashcards → Reading → Translation → Edit.
- **Manifest-first:** sentence order and LV text are fixed by the **manifest** (SIDs), never by LLM
  output.
- **Tool-use first:** all LLM responses are produced via a **single emitter tool** (forced with
  `tool_choice`) and validated with **Zod**.
- **Batch-ready:** full support for **Message Batches** (feature parity with Messages API, incl.
  tools) plus offline **JSONL** imports.
- **Config-first:** no magic numbers. Behavior (models, limits, keybinds, themes, i18n, delays,
  fonts, sizes…) lives in `/config` and is validated.
- **Mobile-first:** responsive UI, desktop hotkeys, mobile-friendly interactions.
- **Future-ready:** ingestion (PDF/OCR/Images/Subtitles), media follow-highlight, TTS/Images, local
  NLP/MT, profiles & subscriptions.

**Runtime:** Node **v24.6.0** (ESM), npm **v11.5.1**. Lint formatter:
**eslint-formatter-codeframe**.

---

## 🗺️ Repository layout

```
flashcards-v3/
├─ doc/
│  ├─ plan/                       # plan_1.md … plan_5.md (MVP → v2.0)
│  ├─ trs/                        # TRS (single source for acceptance)
│  ├─ roadmap/                    # long-term roadmap
│  └─ best_practices/
│     ├─ best_practices0.md       # Modern Best Practices 2025 (React/TS/Node)
│     ├─ best_practices1.md       # Our stack best practices (2025)
│     ├─ Message Batches.md       # Using Message Batches API in React
│     ├─ MessageBatches2.md       # Parsing batch results (React)
│     ├─ TechnicalGuidesForClaudeAPIv2.0.md  # Highest priority after official Anthropic docs
│     └─ tool-use.md              # Tools: JSON-only, caching, stop reasons, parallel rules
│
├─ config/                        # JSON/TS configs (validated by Zod/JSON Schema)
├─ server/                        # CommonJS mock-proxy (ts-node + nodemon)
├─ src/
│  ├─ components/                 # UI only (no async/side-effects)
│  ├─ hooks/                      # business logic, effects, network, FSM glue
│  ├─ utils/                      # pure functions, DTO/schema, manifest/aggregation
│  ├─ locales/                    # i18n: ru.json, uk.json, en.json, …
│  └─ styles/
├─ public/
├─ AGENT.md                       # Repo-wide rules for AI-assisted coding
├─ Codex.md                       # UI/UX and code conventions
├─ package.json
└─ …
```

**Docs priority:** Official Anthropic docs → `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md`
→ `Message Batches.md` / `MessageBatches2.md`.

---

## 🧩 App modes (MVP)

- **Text:** input area; toggle **Use batch processing** (button label switches to “Start batch
  processing”). **Get batch results** form (enter `batch_id`, load, and see results); batch history
  with **expired** mark after 29 days. **Pre-flight** `/api/health` before any start/load.
- **Flashcards:** ←/→ navigate; Space/↑/↓ flip; `h` hide (not delete). Contexts: show **N** with
  “show more” up to **M** (from config). Rounded corners + flip animation. Font **Noto Sans
  Display** from config.
- **Reading:** distinct highlights for **words** vs **phrases** (+ legend); phrase wins on overlap.
  Tooltip shows **surface-form** translation; viewport-aware positioning; optional delay, debounce,
  cancel on leave, single-flight requests. (v1.1) right-click/long-press context menu from config.
- **Translation:** stats bar (words by UAX-29, characters by **graphemes**, sentences by SID,
  phrases).
- **Edit:** table with pagination; **VISIBLE** per card + **Master Visible**; edit base translation
  and context translations with **instant propagation** to all modes; “edit contexts (N)”;
  **Restore** (v1.1).

---

## 🧠 Architecture (high level)

- **Manifest/SID:** LV is segmented → manifest `{ sid, lv, sig }`. RU/target text is assembled
  **strictly by SID order**.
- **FSM → UI:** batch lifecycle and other flows use explicit finite state machines; UI renders from
  FSM state.
- **Strict DTOs:** Zod at boundaries (HTTP/tool results/JSONL). Any mismatch → fail-fast with a
  clear message.
- **Stores:** manifest (source of truth) → card/context stores → views
  (Flashcards/Reading/Translation/Edit).
- **Adapters:** `LLMAdapter` (Anthropic default; OpenAI-ready), `BatchAdapter`,
  `Pdf/Ocr/Image/Subtitle/Clipboard`, `PlayerAdapter`, `TTSAdapter`/`ImageAdapter` (future),
  `Lemma/Dictionary/MT` (future local NLP).

---

## 🛠️ Claude **tool-use** (TL;DR)

⚠️ Tool-use (JSON-only, emit_flashcards) — в разработке; текущая сборка использует mock batch-proxy.

Текущий статус см. в [doc/STATUS.md](doc/STATUS.md).

- **Why:** tools guarantee **JSON-only** structures far better than textual prompts.
- **Pattern:** each request provides `{ system, messages, tools, tool_choice }`. We **force** a
  single **flashcards emitter tool** via `tool_choice`.
- **Parse:** read the result from **`tool_use.input`**, then **Zod-validate** (no prose around
  JSON).
- **Parallel:** **disabled by default**. If enabled, all `tool_result` items must appear in **one**
  subsequent **user** message, before any text (Anthropic rule).
- **Prompt caching:** keep `system` and `tools` **stable** to leverage provider cache (best-effort).
  Changing `tool_choice` can invalidate cache blocks—plan for it.

**Cards schema (strict JSON):**

```ts
type Unit = 'word' | 'phrase';
interface FormEntry {
  form: string;
  translation: string;
}
interface Context {
  latvian: string;
  russian: string;
  forms: FormEntry[];
}
interface Card {
  unit: Unit;
  base_form: string;
  base_translation?: string;
  contexts: Context[];
  visible: boolean;
}
type Payload = Card[] | { flashcards: Card[] }; // tool-use → {flashcards}, else pure Card[]
```

---

## 📦 Message Batches (Claude v2.0)

- **Parity:** Batches support the same features as Messages API, including **tools**. Each JSONL
  line carries the same `params`.
- **Aggregation:** set `custom_id = SID`; JSONL order is not guaranteed; aggregate by SID; keep
  `status: succeeded|errored|canceled|expired`; store diagnostics for errors.
- **Polling:** adaptive intervals (1–2s → 3–5s → 10–30s → 30–60s) with jitter; **honor
  `Retry-After`**.
- **Retry/limits:** `429/5xx/timeout/network` → exponential backoff + jitter; respect RPM/TPM;
  idempotent retries.
- **Stop reasons:** check `stop_reason`:
  - `max_tokens` is a **soft stop**, not an HTTP error.
  - **Single**: retry with higher `max_tokens`.
  - **Batch**: **split-retry** only affected chunks; keep partial successes; never block the whole
    batch.

---

## 🔤 Segmentation (SID stability)

- Engines: `primitive` (default), `latvian_sentence_tester:local`, `latvian_sentence_tester:http`
  (fallback on 5xx/429/timeout).
- `SID = hash((docId||'')+':'+start+':'+end)` (engine-independent). Manifest is built **only** from
  the segmentation result.
- Golden tests ensure identical `(start,end)` and SIDs on reruns.

---

## ⚙️ Configuration policy (Config-first)

- **No hardcoded values.** Everything reads from `/config/*.json` (or TS) validated by Zod/JSON
  Schema at startup (**fail-fast**).
- **Decomposition:** `app.json`, `i18n.json`, `theme.json`, `network.json`, `llm.json`,
  `batch.json`, `flashcards.json`, `reading.json`, `translation.json`, `edit.json`, `io.json`,
  `ingestion/*.json`, `media.json`, `pipeline.json`, `nlp.json`.
- **Docs (RU):** each config has `/doc/configs/<name>.md` (purpose, keys, defaults, examples,
  dependencies, changelog, owner).
- **Index & validation:** `npm run docs:config` builds `CONFIG_INDEX.md`; `npm run validate:config`
  validates all configs.
- **Anti-hardcode:** `npm run lint:anti-hardcode` fails PRs with model names, intervals, keycodes,
  etc., wired in code.

---

## 🛡️ Errors, health & batch UX

- **Health pre-flight:** front calls `/api/health` before any processing; if proxy or network is
  down, the **banner appears immediately** (not just console logs).
- **Handled codes:** `429` (rate limits), `413` (request too large), `500` (server error), `529`
  (overloaded). Localized banners and retry policies per code.
- **Expired batches:** history marks `expired` after **29 days** (Anthropic retention).

---

## 📚 Документация и проверки

- Конфиги: RU‑доки в `doc/configs/*.md`, индекс — `doc/configs/CONFIG_INDEX.md`.
- Валидация конфигов: `npm run validate:config` (fail‑fast отчёт, Zod).
- Линт (codeframe): `npm run lint -- --format codeframe`.
- Анти‑хардкод: `npm run lint:anti-hardcode`.
- Тесты: `npm run test`, E2E (smoke): `npm run e2e`.
- **Docs priority:** if `Message Batches.md` conflicts with `TechnicalGuidesForClaudeAPIv2.0.md`,
  follow the v2.0 guide (after official docs).

---

## 🌐 i18n & Theming

- UI strings live in `/src/locales/{ru,uk,en}.json` (fallback `en`).
- `i18n.targetLanguage` sets the target translation language (RU/UK/…), affecting
  Flashcards/Reading/Translation **without code changes**.
- Themes: `light | dark | system` (respects `prefers-color-scheme`); design tokens via Tailwind/CSS
  variables.

---

## 🧪 Tests & quality

- **Unit:** tooltip controller (delay/debounce/cancel/single-flight), reducers/FSM, text stats
  (Intl.Segmenter), JSONL parser/merge strategies, anti-hardcode.
- **Golden/Property-based:** SID order invariants; JSONL permutations; duplicates/missing SIDs; FSM
  determinism.
- **E2E (Cypress):** full happy paths per mode; proxy/network failures; batch history;
  import/export/restore; tool-use/stop-reasons UX.
- **Lint:** ESLint + Prettier/Biome; formatter output: **codeframe**.

Useful scripts:

```bash
npm run dev                 # start client + proxy (concurrently)
npm run build               # build app
npm run start               # start production server
npm run lint -- --format codeframe
npm run test                # unit/integration
npm run e2e                 # Cypress
npm run validate:config     # validate all configs (Zod/JSON Schema)
npm run docs:config         # generate CONFIG_INDEX.md
```

---

## 🚀 Quick start

```bash
# prerequisites: Node 24.6.0, npm 11.5.1
git clone https://github.com/nn1k4/flashcards-v3.git
cd flashcards-v3

cp .env.example .env           # set proxy base / API keys if needed
npm ci
npm run validate:config
npm run dev                    # open http://localhost:5173
```

**Read first:**

- `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` (project-priority guide after official
  Anthropic docs)
- `doc/best_practices/tool-use.md` (tools, `tool_choice`, caching hygiene, stop reasons, parallel
  rules)

---

## 🧭 Roadmap & plans

- Stage plans: **`doc/plan/plan_1.md … plan_5.md`** (MVP → v2.0).
- TRS: **`doc/trs/trs_v_5.md`** — full, versioned requirements (acceptance source).
- Long-term: **`doc/roadmap/roadmap.md`**.

---

## 🔒 Security & privacy

- API keys live on the **proxy** only; never ship keys to the browser.
- Future profiles/subscriptions: encrypted storage (AES-GCM), HttpOnly tokens, CSRF protections,
  minimal logs.

---

## ♿ Accessibility

- Keyboard navigation (focus rings, ARIA) across modes.
- High-contrast theming; tooltip/menu positioning respects viewport; mobile popovers.

---

## 🤝 Contributing

1. Read **`AGENT.md`** and **`Codex.md`** (coding/UI rules, config-first).
2. Document configs (RU) under `doc/configs/*`; keep Zod schemas in sync.
3. **No hardcoded values** (models, intervals, keycodes, sizes, fonts, colors, chunk sizes…).
4. Add/Update tests (unit + E2E); run lint with **codeframe**.
5. Reference TRS acceptance criteria in your PR.
6. Follow **tool-use** policy: JSON-only via tools, parse `tool_use.input` + Zod, prompt caching
   hygiene, handle **`max_tokens`** (bump/split-retry), parallel rules.

---

## 🙌 Acknowledgements

- **Anthropic Claude** (Messages + Message Batches).
- **Helsinki-NLP / TildeLM** (future local MT path).
- **Latvian language community** & open-source tools enabling segmentation and analysis.

---

## 📄 License

TBD (see `LICENSE`).
