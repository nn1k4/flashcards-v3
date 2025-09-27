# manual_codex.md — How to work with ChatGPT Codex for `flashcards-v3`

> This is a **hands-on, step-by-step** guide for using **ChatGPT Codex** to implement and maintain
> `nn1k4/flashcards-v3` strictly according to **TRS v5.x**, **plans (plan_1…plan_5)**, **roadmap**,
> and repo rules (**AGENT/Codex**). Outcome: a predictable loop where Codex proposes minimal diffs +
> tests, you review, and merge safely.

---

## 0) One-time setup (before your first task)

1. **Access Codex**

- Open ChatGPT → **Codex** (web app). Ensure you can start a Codex session.

2. **Connect GitHub**

- ChatGPT Settings → **Connectors** → **GitHub** → authorize → select **`nn1k4/flashcards-v3`**
  read/write PR access.

3. **(Optional) Codex CLI**

- If you prefer local edits without pushing code: install Codex CLI and sign in. You can apply
  patches locally, run tests, then push.

4. **Data controls**

- Review privacy/data controls. Keep secrets in `.env` on **server** only; never paste keys into
  Codex messages.

---

## 1) Canon of truth (read in this order)

1. **TRS**: `doc/trs/trs_v_5.md` — _source of truth_ (features, NFRs, acceptance).
2. **Roadmap**: `doc/roadmap/roadmap.md` — releases & dependencies.
3. **Plans**: `doc/plan/plan_1.md … plan_5.md` — per-stage scope.
4. **Best practices**:
   - `doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md` (priority after vendor docs)
   - `doc/best_practices/Message Batches.md`, `MessageBatches2.md`
   - `doc/best_practices/tool-use.md` ← **our tool-use policy (JSON-only via tools, caching, stop
     reasons)**

5. **Repo guides**: `AGENT.md`, `Codex.md`, `src/components/AGENT.md`, `src/hooks/AGENT.md`,
   `src/utils/AGENT.md`
6. **README.md**

**Architecture invariants (must not break):** Manifest-first; SID-centric aggregation; **JSON-only**
LLM outputs (via tools); Config-first; i18n/themes; FSM→UI; immediate error banners for
429/413/500/529/network/proxy-down/expired; Node 24.6.0 (ESM), npm 11.5.1; TS strict +
exactOptionalPropertyTypes.

---

## 2) Start every Codex session with a short “context pack”

Paste this at the top of a **new** Codex session:

```
PROJECT: nn1k4/flashcards-v3

READ IN THIS ORDER:
- TRS: doc/trs/trs_v_5.md
- Roadmap: doc/roadmap/roadmap.md
- Plans: doc/plan/plan_1.md … plan_5.md (say which plan you’re on)
- Best practices: doc/best_practices/TechnicalGuidesForClaudeAPIv2.0.md,
  Message Batches.md, MessageBatches2.md, tool-use.md, best_practices0.md, best_practices1.md
- Repo guides: AGENT.md, Codex.md, src/components/AGENT.md, src/hooks/AGENT.md, src/utils/AGENT.md
- README.md

INVARIANTS:
- Manifest-first; SID aggregation; JSON-only (Claude tools); Config-first (no hardcoded values);
- FSM→UI; i18n/themes; immediate error banners for 429/413/500/529/network/proxy-down/expired.
- Claude tool-use: single tool emitter for cards, tool_choice forced; cache stable system/tools; handle stop_reason=max_tokens (bump/split-retry).
```

---

## 3) The working loop (repeat for each task)

### 3.1 Pick the next item from the current plan

- Work **top-down** in `doc/plan/plan_X.md` (e.g., S0→S1→S2).
- Copy the relevant **Acceptance** from TRS/plan.

### 3.2 Use this **task prompt template** in Codex

Replace only the `<…>` blocks:

```
ROLE
You are Codex working on repo nn1k4/flashcards-v3 with GitHub access.
Follow TRS/Plans exactly. Do not add scope beyond the current plan step.

TASK
- Plan step: <e.g., plan_1.md §S1 Proxy & Errors>
- Relevant TRS sections: <§ ids from trs_v_5.md, e.g., §7, §8, §16>
- Acceptance criteria (paste from TRS/plan):
  <• …>
- Files likely involved:
  <paths, e.g., server/*, src/api/client.ts, src/hooks/useBatch.ts, src/components/Banners/*, config/*.json>

CONSTRAINTS
- Manifest-first; SID aggregation; JSON-only via Claude tools (see doc/best_practices/tool-use.md);
- Config-first (no hardcoded values); Zod validation at boundaries; i18n/themes; FSM→UI.
- Lint format: eslint-formatter-codeframe.

OUTPUT CONTRACT (STRICT)
1) <analysis> — brief reasoning + dependencies.
2) <plan> — step list with file paths.
3) <changeset> — git unified diffs (minimal patches); no renames unless needed.
4) <tests> — unit + RTL/Cypress; golden/property-based where relevant.
5) <docs> — which sections in AGENT/Codex/config docs to update.
6) <commit> — conventional commit title + description referencing TRS/plan.
7) <postchecks> — verify acceptance, no hardcodes, types/tests green.

NEVER
- No hardcoded models/intervals/keybinds/strings; read from /config with Zod.
- Never rely on JSONL row order; aggregate strictly by SID.
- Don’t hide errors in console; show user banners.

BEGIN.
```

---

## 4) Tool-use, caching, and stop reasons — what Codex must generate

When the task touches LLM code (single or batches), require Codex to follow **our tool-use policy**
(`doc/best_practices/tool-use.md`):

- **JSON-only via tools**: define one **emitter tool** (e.g., `emit_flashcards`) with a strict
  schema; parse `tool_use.input` with Zod (`zPayloadCards`).
- **Force tool**:
  `tool_choice: { type: "tool", name: "emit_flashcards", disable_parallel_tool_use: true }`.
- **Prompt caching**: keep `system` + `tools` blocks stable; Codex must place stable prefixes in
  cacheable blocks (best-effort). Changing `tool_choice` can invalidate cache; document it.
- **Stop reasons**: explicitly handle `stop_reason == "max_tokens"`:
  - **Single**: retry with a higher `max_tokens`.
  - **Batch**: split-retry the problematic chunk; aggregate partial successes; keep the UI
    responsive.

- **Batches parity**: JSONL batch params = Messages API params (same `tools`, `tool_choice`, etc.).
- **Parallel tools**: off by default. If later enabled, **all** `tool_result` must go in **one**
  user message **first**, then text.

> Ask Codex to add/update hooks (`useBatch`, `useProcessing`) and utils to meet this policy
> (validation, aggregation, retries with backoff+jitter, `Retry-After`).

---

## 5) Ask Codex for patches + PR

- In the task request, always ask for **git unified diffs** and **test additions**.
- If GitHub connector is enabled, ask Codex to **create a branch & PR** with the given commit
  message and checklist.

---

## 6) Local verify checklist (after Codex replies)

Run locally:

```bash
npm ci
npm run validate:config
npm run lint -- --format codeframe
npm run test
npm run e2e
npm run dev
```

Accept only if **all** hold:

- ✅ Unit/E2E green; no TypeScript errors.
- ✅ Error banners appear **immediately** when proxy is down / no network / 429/413/500/529 /
  expired.
- ✅ No hardcodes (models, intervals, keybinds, sizes, strings).
- ✅ Patches reference the exact TRS/plan sections.
- ✅ RU docs for configs updated; Zod schemas in sync; i18n keys present.

If something’s off, reply in the **same Codex thread**:

```
Re-run with the same TASK, but:
- keep <file X> unchanged,
- split into smaller commits,
- add tests for <edge-case>,
- show config & Zod schema changes explicitly,
- ensure tool-use JSON-only and stop_reason=max_tokens handling.
Return only <analysis|plan|changeset|tests|docs|commit|postchecks>.
```

---

## 7) Ready-to-paste **starter prompts** (first milestones)

### A) S1 — Proxy & Errors (plan_1.md)

Goal: `/api/health`, normalized error mapping (429/413/500/529/network/proxy-down/expired), adaptive
polling with `Retry-After`, banners under the batch toggle.

Use the **task template** with:

- TRS: §7 **Batch-режим**, §8 **Ошибки/Сеть/Прокси**, §12 **НФТ**, §16 **Конфиги**, §17–18
  **Acceptance/Tests**.
- Files: `server/*`, `src/api/client.ts`, `src/hooks/useBatch.ts`, `src/components/Banners/*`,
  `config/{network,batch}.json`, Zod schemas.

**Acceptance (short):** health pre-flight; immediate banners; polling with jitter; error mapping;
tests.

---

### B) S2 — Pipeline Core & Config-first (plan_1.md)

Goal: Manifest/SID pipeline; Zod schemas for `/config`; anti-hardcode lint; RU config docs.

- TRS: §4 **Pipeline**, §3 **Config-policy**, §16 **Keys**, §17–18.
- Files: `src/utils/{manifest,aggregator,fsm,schema}.ts`, `config/*`, `doc/configs/*`,
  `scripts/lint:anti-hardcode`.

**Acceptance:** deterministic segmentation & manifest; config validation; zero hardcode violations.

---

### C) S3/S4 — Flashcards & Reading core (plan_1.md)

Goal: hotkeys from config; Reading tooltip controller (delay/debounce/cancel/single-flight);
phrase-over-word priority; viewport-safe positioning; **reveal-on-peek** (policy in config).

- TRS: §5 **UI modes**, §9 **Visibility policy**, §12, §16–18.
- Files: `src/components/{Flashcards,Reading}/*`,
  `src/hooks/{useTooltipController,useVisibilityPolicy,useHotkeys}`,
  `config/{flashcards,reading}.json`.

**Acceptance:** working hotkeys, deterministic tooltips, reveal-on-peek togglable, tests.

---

## 8) Quality contracts you must demand from Codex (every PR)

- **No hardcoded values** → all from `/config` + Zod.
- **JSON-only** LLM through **tools**; parse `tool_use.input` with `zPayloadCards`.
- **SID-only aggregation**; JSONL order ignored.
- **Prompt caching hygiene** (stable `system/tools`); warn that `tool_choice` may invalidate cache.
- **Stop reasons** handled (`max_tokens` bump/split-retry); distinguish from HTTP errors.
- **i18n/themes & a11y** respected; **FSM→UI** (no rogue setState).
- **Tests** include unit + RTL/Cypress, golden/property-based where relevant.
- **Docs** updated (AGENT/Codex/config RU docs).
- **Commit** uses conventional title + body referencing TRS/plan.

---

## 9) Typical pitfalls & how to avoid

- **Relying on JSONL order** → always map by `custom_id == SID`.
- **Free-form JSON from LLM** → force **tool_use** with strict schema, Zod validate.
- **Hidden hardcodes** (model names, intervals, keybinds) → move to `/config`, add Zod & RU docs.
- **Tooltip storms** → `request.strategy="afterDelay"`, debounce, single-flight.
- **`max_tokens` treated as error** → it’s a **stop reason**; retry/split, don’t fail the pipeline.
- **Cache misuse** → keep `system/tools` stable; expect cache best-effort only.

---

## 10) Moving between releases

Advance to the next plan only when **DoD** of the current plan is met (see plan_1…plan_5 and TRS
§Acceptance). If Codex proposes out-of-scope changes, respond: _“Out of scope for current plan;
propose as optional RFC with rationale.”_

---

## 11) Quick commands (local)

```bash
npm run dev
npm run build
npm run lint -- --format codeframe
npm run test && npm run e2e
npm run validate:config
npm run docs:config
```

---

## 12) Minimal PR checklist (paste into the PR body)

- [ ] References: TRS §…, plan_X §…
- [ ] No hardcoded values; config + Zod added/updated (+ RU docs)
- [ ] Tool-use JSON-only; `tool_choice` forced; Zod validation of tool input
- [ ] `max_tokens` handling (bump/split-retry) implemented where applicable
- [ ] Error banners for 429/413/500/529/network/proxy-down/expired
- [ ] Tests: unit + RTL/Cypress (+ golden/property-based if relevant)
- [ ] i18n keys added; themes respected; a11y OK
- [ ] TS strict passes; lint codeframe clean

---

### Final note

Keep the **scope tight**, patches minimal, and always cite the exact TRS/plan sections in tasks and
commits. Codex is most effective when you feed it **precise acceptance** + **strict output
contract** and review with the checklist above.
