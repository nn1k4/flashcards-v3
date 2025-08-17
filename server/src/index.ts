import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { ZManifest, type Manifest, ZBatchResultV1, type BatchResultV1 } from './schemas';


// Простая in-memory "очередь" задач
type Job =
  | { status: 'processing'; manifest: Manifest; createdAt: number }
  | { status: 'completed'; manifest: Manifest; result: BatchResultV1; createdAt: number; finishedAt: number }
  | { status: 'failed'; manifest: Manifest; error: string; createdAt: number; finishedAt: number };

const jobs = new Map<string, Job>();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Утилита "перевода" (заглушка)
function translateLvToRu(lv: string): string {
  // Примитивная имитация
  return lv.replace(/\s+/g, ' ').trim() ? `RU: ${lv}` : '';
}

// Случайно перемешать массив (чтобы проверить, что клиент агрегирует по SID)
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// POST /claude/batch — принять весь манифест и создать "задачу"
app.post('/claude/batch', (req, res) => {
  const parse = ZManifest.safeParse(req.body?.manifest ?? req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid manifest', details: parse.error.flatten() });
  }

  const manifest = parse.data;
  const batchId = manifest.batchId || randomUUID();

  // Регистрируем задачу
  jobs.set(batchId, { status: 'processing', manifest, createdAt: Date.now() });

  // Имитация фона: через 2–4 сек готовим результат
  const delay = 2000 + Math.floor(Math.random() * 2000);
  setTimeout(() => {
    const job = jobs.get(batchId);
    if (!job || job.status !== 'processing') return;

    const started = Date.now();
    // Формируем items в СЛУЧАЙНОМ порядке, чтобы клиент агрегировал по SID
    const items = shuffle(
      manifest.items.map((it) => ({
        sid: it.sid,
        sig: it.sig,
        russian: translateLvToRu(it.lv),
        cards: [] as any[],
        processingTime: 50 + Math.floor(Math.random() * 50),
      }))
    );

    // Пример частичной ошибки (опционально)
    const errors: BatchResultV1['errors'] | undefined =
      manifest.items.length > 2
        ? [{ sid: manifest.items[1]!.sid, error: 'Temporary processing error', errorCode: 'TEMP' }]
        : undefined;

    const result: BatchResultV1 = {
      schemaVersion: 1,
      batchId,
      items,
      ...(errors ? { errors } : {}),
      metadata: {
        totalProcessingTime: Date.now() - started,
        model: 'mock-llm',
        chunksProcessed: new Set(manifest.items.map((i) => i.chunkIndex)).size,
      },
    };

    // Валидация перед отправкой — строгие контракты
    const check = ZBatchResultV1.safeParse(result);
    if (!check.success) {
      jobs.set(batchId, { status: 'failed', manifest, error: 'Result schema invalid', createdAt: job.createdAt, finishedAt: Date.now() });
      return;
    }

    jobs.set(batchId, { status: 'completed', manifest, result, createdAt: job.createdAt, finishedAt: Date.now() });
  }, delay);

  return res.json({ batchId });
});

// GET /claude/batch/:batchId — 202 пока считается, 200 когда готово, 404 если не найдено
app.get('/claude/batch/:batchId', (_req, res) => {
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).end();

  if (job.status === 'processing') return res.status(202).end();
  if (job.status === 'failed') return res.status(500).json({ error: job.error });

  // completed
  return res.json(job.result);
});

// DELETE /claude/batch/:batchId — отмена
app.delete('/claude/batch/:batchId', (_req, res) => {
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).end();
  jobs.delete(batchId);
  return res.status(204).end();
});

// (Опционально) GET /claude/batch/:batchId/status — удобный статус с прогрессом
app.get('/claude/batch/:batchId/status', (_req, res) => {
  const { batchId } = _req.params;
  const job = jobs.get(batchId);
  if (!job) return res.status(404).json({ status: 'failed', error: 'not found' });

  if (job.status === 'processing') {
    return res.json({ status: 'processing', progress: 0.7 });
  }
  if (job.status === 'failed') {
    return res.json({ status: 'failed', error: 'internal error' });
  }
  return res.json({ status: 'completed', progress: 1 });
});

app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});
