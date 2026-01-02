import cors from 'cors';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { ZBatchResultV1, ZManifest, type BatchResultV1, type Manifest } from './schemas';
// Load .env (server/.env) before reading any env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// -------------------------------
// In-memory "очередь" задач
// -------------------------------
type Job =
  | { status: 'processing'; manifest: Manifest; createdAt: number }
  | {
      status: 'completed';
      manifest: Manifest;
      result: BatchResultV1;
      createdAt: number;
      finishedAt: number;
    }
  | { status: 'failed'; manifest: Manifest; error: string; createdAt: number; finishedAt: number };

const jobs = new Map<string, Job>();

const app = express();

// CORS: allow all in dev; restrict by ALLOWED_ORIGINS in prod if provided
function resolveCors() {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return cors();
  return cors({
    origin(origin, cb) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return cb(null, true);
      const ok = allowed.some((o) => origin === o || origin.startsWith('http://localhost:'));
      if (!ok) {
        console.warn(`[CORS] Blocked origin: ${origin}, allowed: ${allowed.join(', ')}`);
      }
      cb(null, ok); // Don't throw error, just reject
    },
    optionsSuccessStatus: 204,
  });
}
app.use(resolveCors());

// Global JSON body limit (keep modest); provider routes still small payloads
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

// -------------------------------
// Утилиты
// -------------------------------

// Примитивная "переводческая" заглушка
function translateLvToRu(lv: string): string {
  return lv.replace(/\s+/g, ' ').trim() ? `RU: ${lv}` : '';
}

// Перемешивание массива, чтобы проверять агрегацию по SID на клиенте
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Простая генерация мок-карточки на основе LV
function makeMockCard(lv: string, sid: number, sig: string) {
  // Берём первые 2–3 токена как "формы"
  const words = lv
    .replace(/[^\p{L}\p{M}\-']/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const base = words[0] ?? '—';

  return {
    base_form: base,
    base_translation: `RU: ${base}`,
    unit: 'word',
    forms: words.slice(0, Math.min(3, words.length)).map((w) => ({
      form: w,
      translation: `RU: ${w}`,
      type: 'token',
    })),
    contexts: [{ lv, ru: `RU: ${lv}`, sid, sig }],
    visible: true,
  };
}

// -------------------------------
// Маршруты
// -------------------------------

// Healthcheck (удобно для smoke-тестов через прокси)
app.get('/healthz', (_req, res) => res.json({ ok: true }));
// TRS §8: фронт вызывает /api/health (Vite proxy перезапишет на /health)
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'flashcards-proxy', version: 'mock-1' }),
);

// -------------------------------
// NEW: Single (tools JSON-only, mock) — возвращает tool_use блока emit_flashcards
// -------------------------------
/**
 * POST /claude/single
 * Body: { text?: string, manifest?: Manifest }
 * Response (mock): { content: [{type:'tool_use', name:'emit_flashcards', input:{ flashcards: [...] }}], stop_reason:'tool_use' }
 */
app.post('/claude/single', (req, res) => {
  const rawText: string | undefined =
    typeof req.body?.text === 'string' ? req.body.text : undefined;
  const manifestParse = req.body?.manifest ? ZManifest.safeParse(req.body.manifest) : null;

  let baseText = rawText?.trim();
  if (!baseText && manifestParse?.success) {
    baseText = manifestParse.data.items.map((i) => i.lv).join(' ');
  }
  if (!baseText) return res.status(400).json({ error: 'No text or manifest provided' });

  // Простая генерация одной карточки на основе входа
  let sid = 0;
  let sig = 'sig-0';
  if (manifestParse?.success && manifestParse.data.items.length === 1) {
    sid = manifestParse.data.items[0]!.sid;
    sig = manifestParse.data.items[0]!.sig;
  }
  const card = makeMockCard(baseText, sid, sig);
  const payload = { flashcards: [card] };
  return res.json({
    content: [
      {
        type: 'tool_use',
        name: 'emit_flashcards',
        input: payload,
      },
    ],
    stop_reason: 'tool_use',
  });
});

// -------------------------------
// Provider endpoints (feature-flagged via env). If no ANTHROPIC_API_KEY → 501.
// -------------------------------
app.post('/claude/provider/single', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(501).json({ error: 'provider integration disabled' });

  try {
    // Accept { text?: string, manifest?: Manifest, model?: string, max_tokens?: number }
    const rawText: string | undefined =
      typeof req.body?.text === 'string' ? req.body.text : undefined;
    const manifestParse = req.body?.manifest ? ZManifest.safeParse(req.body.manifest) : null;
    let baseText = rawText?.trim();
    if (!baseText && manifestParse?.success)
      baseText = manifestParse.data.items.map((i) => i.lv).join(' ');
    if (!baseText) return res.status(400).json({ error: 'No text or manifest provided' });

    const model: string =
      (typeof req.body?.model === 'string' && req.body.model) || ANTHROPIC_MODEL;
    const maxTokens: number = Number(req.body?.max_tokens) > 0 ? Number(req.body.max_tokens) : 1024;

    // Minimal tool definition aligned with client expectations
    const toolDef = {
      name: 'emit_flashcards',
      description:
        'Emit a strictly structured JSON object with flashcards for the given Latvian text. Each flashcard must have base_form (Latvian), base_translation (Russian translation of base_form), unit, visible, and at least one context with lv and ru.',
      input_schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          flashcards: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                unit: { type: 'string', enum: ['word', 'phrase'] },
                base_form: { type: 'string', description: 'Latvian base/dictionary form' },
                base_translation: {
                  type: 'string',
                  description: 'Russian translation of base_form',
                },
                forms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      form: { type: 'string' },
                      translation: { type: 'string' },
                      type: { type: 'string' },
                    },
                    required: ['form', 'translation'],
                  },
                  default: [],
                },
                contexts: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      lv: { type: 'string' },
                      ru: { type: 'string' },
                      sid: { type: 'number' },
                      sig: { type: 'string' },
                    },
                    required: ['lv', 'ru'],
                  },
                },
                visible: { type: 'boolean' },
              },
              required: ['unit', 'base_form', 'base_translation', 'contexts', 'visible'],
            },
          },
        },
        required: ['flashcards'],
      },
    } as const;

    const body = {
      model,
      max_tokens: maxTokens,
      system:
        'You are a JSON-only tool emitter. Use the emit_flashcards tool to return a non-empty flashcards array for the given Latvian text. Each flashcard must include base_form, base_translation (Russian translation of base_form), unit, visible=true, and at least one context with lv and ru. No prose.',
      messages: [{ role: 'user', content: [{ type: 'text', text: baseText }] }],
      tools: [toolDef],
      tool_choice: { type: 'tool', name: 'emit_flashcards' },
      // Note: do not send disable_parallel_tool_use — provider rejects unknown fields
    } as const;

    const r = await fetchWithTimeout(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).type('application/json').send(text);
    // Forward provider content as-is; client expects { content, stop_reason }
    return res.type('application/json').send(text);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message || 'provider error' });
  }
});

app.post('/claude/provider/batch/build-jsonl', (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(501).json({ error: 'provider integration disabled' });

  // Reuse the same builder logic as mock, but behind provider path and model override
  const parse = ZManifest.safeParse(req.body?.manifest ?? req.body);
  if (!parse.success)
    return res.status(400).json({ error: 'Invalid manifest', details: parse.error.flatten() });
  const manifest = parse.data;
  const model = (typeof req.body?.model === 'string' && req.body.model) || ANTHROPIC_MODEL;

  const lines = manifest.items.map((it) => {
    const system = 'Return strictly structured JSON via emit_flashcards tool.';
    const tools = [
      {
        name: 'emit_flashcards',
        description:
          'Return a strictly structured JSON object with flashcards (no free text outside fields).',
        input_schema: {
          type: 'object',
          properties: { flashcards: { type: 'array' } },
          required: ['flashcards'],
        },
      },
    ];
    const messages = [{ role: 'user', content: [{ type: 'text', text: it.lv }] }];
    const params = {
      model,
      system,
      tools,
      tool_choice: { type: 'tool', name: 'emit_flashcards' },
      messages,
      max_tokens: 1000,
    };
    return JSON.stringify({ custom_id: it.sid, params });
  });

  return res.json({ lines });
});

// POST /claude/provider/batch — submit a provider-backed batch job
app.post('/claude/provider/batch', (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(501).json({ error: 'provider integration disabled' });

  const parse = ZManifest.safeParse(req.body?.manifest ?? req.body);
  if (!parse.success) {
    console.error('[batch] Invalid manifest:', parse.error.flatten());
    return res.status(400).json({ error: 'Invalid manifest', details: parse.error.flatten() });
  }
  const manifest = parse.data;
  const batchId = manifest.batchId || randomUUID();

  console.log(`[batch] Received batch ${batchId} with ${manifest.items.length} items`);

  jobs.set(batchId, { status: 'processing', manifest, createdAt: Date.now() });

  // Process asynchronously
  (async () => {
    console.log(`[batch] Starting async processing for ${batchId}...`);
    const started = Date.now();
    const items: BatchResultV1['items'] = [];
    const errors: NonNullable<BatchResultV1['errors']> = [];

    for (const it of manifest.items) {
      console.log(`[batch] Processing item sid=${it.sid}, lv="${it.lv.slice(0, 50)}..."`);
      try {
        const reqBody = {
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system:
            'You are a JSON-only tool emitter. Use the emit_flashcards tool to return a non-empty flashcards array for the given Latvian sentence. Each flashcard must include base_form, base_translation (Russian translation of base_form), unit, visible=true, and at least one context with lv and ru. No prose.',
          messages: [{ role: 'user', content: [{ type: 'text', text: it.lv }] }],
          tools: [
            {
              name: 'emit_flashcards',
              description:
                'Emit a strictly structured JSON with flashcards for the sentence. Each flashcard must have base_form (Latvian), base_translation (Russian translation of base_form), unit, visible, and at least one context with lv and ru.',
              input_schema: {
                type: 'object',
                required: ['flashcards'],
                properties: {
                  flashcards: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['base_form', 'base_translation', 'unit', 'visible', 'contexts'],
                      properties: {
                        base_form: { type: 'string', description: 'Latvian base/dictionary form' },
                        base_translation: {
                          type: 'string',
                          description: 'Russian translation of base_form',
                        },
                        unit: { type: 'string', enum: ['word', 'phrase'] },
                        visible: { type: 'boolean' },
                        contexts: {
                          type: 'array',
                          items: {
                            type: 'object',
                            required: ['lv', 'ru'],
                            properties: {
                              lv: { type: 'string' },
                              ru: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'emit_flashcards' },
        } as const;

        const r = await fetchWithTimeout(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(reqBody),
        });
        if (!r.ok) throw new Error(`Provider error ${r.status}`);
        const j = await r.json();
        const input = extractToolInput(j, 'emit_flashcards');
        const fc = Array.isArray(input?.flashcards) ? input.flashcards : [];
        const firstRu = fc?.[0]?.contexts?.[0]?.ru;

        items.push({
          sid: it.sid,
          sig: it.sig,
          russian: typeof firstRu === 'string' ? firstRu : undefined,
          cards: (fc || []).map((c: any) => ({
            base_form: String(c.base_form || ''),
            base_translation: c.base_translation ? String(c.base_translation) : undefined,
            unit: c.unit === 'phrase' ? 'phrase' : 'word',
            forms: Array.isArray(c.forms)
              ? c.forms.map((f: any) => ({
                  form: String(f.form || ''),
                  translation: String(f.translation || ''),
                  type: String(f.type || 'token'),
                }))
              : [],
            contexts: Array.isArray(c.contexts)
              ? c.contexts.map((cx: any) => ({
                  lv: String(cx.lv || ''),
                  ru: String(cx.ru || ''),
                  sid: it.sid,
                  sig: it.sig,
                }))
              : [],
            visible: Boolean(c.visible !== false),
          })),
          processingTime: Math.max(1, Date.now() - started),
        });
      } catch (e: any) {
        console.error(`[batch] Error processing sid=${it.sid}:`, e?.message);
        errors.push({ sid: it.sid, error: e?.message || 'provider error', errorCode: 'PROVIDER' });
      }
    }

    console.log(`[batch] Processing complete: ${items.length} items, ${errors.length} errors`);

    const result: BatchResultV1 = {
      schemaVersion: 1,
      batchId,
      items,
      ...(errors.length ? { errors } : {}),
      metadata: {
        totalProcessingTime: Date.now() - started,
        model: ANTHROPIC_MODEL,
        chunksProcessed: new Set(manifest.items.map((i) => i.chunkIndex)).size,
      },
    };

    const job = jobs.get(batchId);
    if (!job || job.status !== 'processing') return;
    const check = ZBatchResultV1.safeParse(result);
    if (!check.success) {
      jobs.set(batchId, {
        status: 'failed',
        manifest,
        error: 'Result schema invalid (provider)',
        createdAt: job.createdAt,
        finishedAt: Date.now(),
      });
      return;
    }
    console.log(`[batch] Job ${batchId} completed successfully`);
    jobs.set(batchId, {
      status: 'completed',
      manifest,
      result,
      createdAt: job.createdAt,
      finishedAt: Date.now(),
    });
  })().catch((err) => {
    console.error(`[batch] Job ${batchId} failed:`, err);
    const job = jobs.get(batchId);
    if (!job) return;
    jobs.set(batchId, {
      status: 'failed',
      manifest,
      error: 'internal error (provider)',
      createdAt: job.createdAt,
      finishedAt: Date.now(),
    });
  });

  return res.json({ batchId });
});

// GET /claude/provider/batch/:batchId — poll provider-backed job
app.get('/claude/provider/batch/:batchId', (_req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(501).json({ error: 'provider integration disabled' });
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  console.log(`[batch] Poll ${batchId}: status=${job?.status ?? 'not found'}`);
  if (!job) return res.status(404).end();
  if (job.status === 'processing') return res.status(202).end();
  if (job.status === 'failed') return res.status(500).json({ error: job.error });
  return res.json(job.result);
});

// GET /claude/provider/batch/:batchId/status — simple status route
app.get('/claude/provider/batch/:batchId/status', (_req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(501).json({ error: 'provider integration disabled' });
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).json({ status: 'failed', error: 'not found' });
  if (job.status === 'processing') return res.json({ status: 'processing', progress: 0.5 });
  if (job.status === 'failed') return res.json({ status: 'failed', error: 'internal error' });
  return res.json({ status: 'completed', progress: 1 });
});

function extractToolInput(j: any, name: string) {
  try {
    const content = j?.content;
    if (!Array.isArray(content)) return undefined;
    for (const b of content) if (b?.type === 'tool_use' && b?.name === name) return b?.input;
  } catch {
    // intentionally empty
  }
  return undefined;
}

// -------------------------------
// NEW: Batch JSONL builder (tools/tool_choice mock)
// -------------------------------
/**
 * POST /claude/batch/build-jsonl
 * Body: { manifest: Manifest, model?: string }
 * Response: { lines: string[] } — каждый элемент это строка .jsonl с { custom_id, params }
 */
app.post('/claude/batch/build-jsonl', (req, res) => {
  const parse = ZManifest.safeParse(req.body?.manifest ?? req.body);
  if (!parse.success)
    return res.status(400).json({ error: 'Invalid manifest', details: parse.error.flatten() });

  const manifest = parse.data;
  const model =
    typeof req.body?.model === 'string' && req.body.model.trim()
      ? req.body.model
      : 'claude-3-haiku-20240307';

  // Определение инструмента (минимально для mock)
  const tools = [
    {
      name: 'emit_flashcards',
      description:
        'Return strictly structured JSON of flashcards (LV/RU) without any prose. This is a virtual tool for JSON-only output.',
      input_schema: {
        type: 'object',
        properties: {
          flashcards: {
            type: 'array',
            items: {
              type: 'object',
              required: ['unit', 'base_form', 'contexts', 'visible'],
              properties: {
                unit: { type: 'string', enum: ['word', 'phrase'] },
                base_form: { type: 'string' },
                base_translation: { type: 'string' },
                contexts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['lv', 'ru'],
                    properties: {
                      lv: { type: 'string' },
                      ru: { type: 'string' },
                      sid: { type: 'number' },
                      sig: { type: 'string' },
                    },
                  },
                },
                visible: { type: 'boolean' },
              },
            },
          },
        },
        required: ['flashcards'],
        additionalProperties: false,
      },
    },
  ];

  const system = {
    type: 'text',
    text: 'You must always respond via the emit_flashcards tool with strict JSON input. No prose.',
  } as const;

  const lines = manifest.items.map((it) => {
    const params = {
      model,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: it.lv }] }],
      tools,
      tool_choice: { type: 'tool', name: 'emit_flashcards' },
      disable_parallel_tool_use: true,
      max_tokens: 1000,
    };
    return JSON.stringify({ custom_id: it.sid, params });
  });

  return res.json({ lines });
});

// POST /claude/batch — принять целый манифест и создать "задачу"
app.post('/claude/batch', (req, res) => {
  const parse = ZManifest.safeParse(req.body?.manifest ?? req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid manifest', details: parse.error.flatten() });
  }

  const manifest = parse.data;
  const batchId = manifest.batchId || randomUUID();

  // Регистрируем задачу
  jobs.set(batchId, { status: 'processing', manifest, createdAt: Date.now() });

  // Имитация фоновой обработки: через 2–4 сек подготовим результат
  const delay = 2000 + Math.floor(Math.random() * 2000);
  setTimeout(() => {
    const job = jobs.get(batchId);
    if (!job || job.status !== 'processing') return;

    const started = Date.now();

    // ❗ Детерминированные "ошибочные" SID для демонстрации: все sid % 4 === 1 считаем failed
    const failedSids = manifest.items.filter((it) => it.sid % 4 === 1).map((it) => it.sid);

    // Формируем items ТОЛЬКО для успешных SID (ошибочные исключаем)
    const items = shuffle(
      manifest.items
        .filter((it) => !failedSids.includes(it.sid))
        .map((it) => ({
          sid: it.sid,
          sig: it.sig,
          russian: translateLvToRu(it.lv),
          cards: [makeMockCard(it.lv, it.sid, it.sig)],
          processingTime: 50 + Math.floor(Math.random() * 50),
        })),
    );

    // Список ошибок (по failedSids) — отдельным полем
    const errors: NonNullable<BatchResultV1['errors']> = failedSids.map((sid) => ({
      sid,
      error: 'Temporary processing error',
      errorCode: 'TEMP',
    }));

    const result: BatchResultV1 = {
      schemaVersion: 1,
      batchId,
      items,
      ...(errors.length ? { errors } : {}),
      metadata: {
        totalProcessingTime: Date.now() - started,
        model: 'mock-llm',
        chunksProcessed: new Set(manifest.items.map((i) => i.chunkIndex)).size,
      },
    };

    // Строгая валидация контракта ответа
    const check = ZBatchResultV1.safeParse(result);
    if (!check.success) {
      jobs.set(batchId, {
        status: 'failed',
        manifest,
        error: 'Result schema invalid',
        createdAt: job.createdAt,
        finishedAt: Date.now(),
      });
      return;
    }

    jobs.set(batchId, {
      status: 'completed',
      manifest,
      result,
      createdAt: job.createdAt,
      finishedAt: Date.now(),
    });
  }, delay);

  return res.json({ batchId });
});

// GET /claude/batch/:batchId — 202 пока считается, 200 когда готово, 404 если нет
app.get('/claude/batch/:batchId', (_req, res) => {
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).end();

  if (job.status === 'processing') return res.status(202).end();
  if (job.status === 'failed') return res.status(500).json({ error: job.error });

  // completed
  return res.json(job.result);
});

// (Опционально) GET /claude/batch/:batchId/status — удобный статус с прогрессом
app.get('/claude/batch/:batchId/status', (_req, res) => {
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).json({ status: 'failed', error: 'not found' });

  if (job.status === 'processing') {
    // Демонстрационный прогресс; в реале верните фактический
    return res.json({ status: 'processing', progress: 0.7 });
  }
  if (job.status === 'failed') {
    return res.json({ status: 'failed', error: 'internal error' });
  }
  return res.json({ status: 'completed', progress: 1 });
});

// DELETE /claude/batch/:batchId — отмена
app.delete('/claude/batch/:batchId', (_req, res) => {
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).end();
  jobs.delete(batchId);
  return res.status(204).end();
});

app.listen(PORT, () => {
  console.warn(`✅ Backend listening on http://localhost:${PORT}`);
});

// Helper: fetch with timeout
function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const timeoutMs = Math.max(
    1000,
    Number(process.env.PROVIDER_TIMEOUT_MS) || init.timeoutMs || 15000,
  );
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(t));
}
