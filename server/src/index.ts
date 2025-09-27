import cors from 'cors';
import { randomUUID } from 'crypto';
import express from 'express';
import { ZBatchResultV1, ZManifest, type BatchResultV1, type Manifest } from './schemas';

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
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

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
  const rawText: string | undefined = typeof req.body?.text === 'string' ? req.body.text : undefined;
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
// NEW: Batch JSONL builder (tools/tool_choice mock)
// -------------------------------
/**
 * POST /claude/batch/build-jsonl
 * Body: { manifest: Manifest, model?: string }
 * Response: { lines: string[] } — каждый элемент это строка .jsonl с { custom_id, params }
 */
app.post('/claude/batch/build-jsonl', (req, res) => {
  const parse = ZManifest.safeParse(req.body?.manifest ?? req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid manifest', details: parse.error.flatten() });

  const manifest = parse.data;
  const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model : 'claude-3-haiku-20240307';

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
