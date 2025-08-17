// src/pages/BatchPlayground.tsx
import React, { useMemo, useState } from 'react';

// МАНИФЕСТ и сплиттер
import { buildManifest, getManifestStats } from '../utils/manifest';

// Главный бизнес-хук батч-оркестрации
import { useBatch } from '../hooks/useBatch';

// Типы
import type { Manifest } from '../types/manifest';

// Узкий тип статуса строки таблицы
type RowStatus = 'ok' | 'failed' | 'pending';

export default function BatchPlayground() {
  // --- Ввод LV текста пользователем ---
  const [lvInput, setLvInput] = useState<string>(
    'Sveiks! Kā tev klājas? Es mācos latviešu valodu.',
  );
  const [maxPerChunk, setMaxPerChunk] = useState<number>(20);

  // --- Манифест (создаём строго перед запуском) ---
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const stats = useMemo(() => (manifest ? getManifestStats(manifest) : null), [manifest]);

  // --- Хук батча (FSM/действия/результат) ---
  const {
    fsmState,
    batchResult,
    progress, // может быть 0 в ready — используем fallback ниже
    processingTime,
    isProcessing,
    canStart,
    canCancel,
    startProcessing,
    cancelProcessing,
    reset,
  } = useBatch(manifest);

  // --- UI-состояния ошибок/логов ---
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Создание манифеста из текста (MANIFEST-FIRST)
  const onBuildManifest = () => {
    setErrorMsg(null);
    try {
      const text = lvInput.trim();
      if (!text) {
        setErrorMsg('Введите латышский текст (минимум одно предложение).');
        return;
      }
      const m = buildManifest(text, Math.max(1, Math.floor(maxPerChunk) || 20));
      setManifest(m);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  // Запуск обработки
  const onStart = async () => {
    setErrorMsg(null);
    try {
      if (!manifest) onBuildManifest();
      await startProcessing();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  // Отмена
  const onCancel = async () => {
    setErrorMsg(null);
    try {
      await cancelProcessing();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  // Сброс
  const onReset = () => {
    setErrorMsg(null);
    reset();
    // оставляем манифест, чтобы можно было повторно запустить
  };

  // -----------------------------
  // Метрики и статусы по SID (восстанавливаем из cards.contexts + манифеста)
  // -----------------------------
  const sidList = useMemo(() => manifest?.items.map((i) => i.sid) ?? [], [manifest]);
  const sigBySid = useMemo(
    () => new Map(manifest?.items.map((i) => [i.sid, i.sig]) ?? []),
    [manifest],
  );

  // Берём OK-SID из карточек: contexts[].sid
  const okSidCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const card of batchResult?.cards ?? []) {
      for (const ctx of card.contexts ?? []) {
        if (typeof ctx.sid === 'number') {
          map.set(ctx.sid, (map.get(ctx.sid) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [batchResult]);

  const okSet = useMemo(() => new Set([...okSidCounts.keys()]), [okSidCounts]);

  const isReady = fsmState.batchState === 'ready';

  // В ready pending быть не должно
  const failedSet = useMemo(() => {
    if (!isReady) return new Set<number>();
    const fs = new Set<number>();
    for (const sid of sidList) if (!okSet.has(sid)) fs.add(sid);
    return fs;
  }, [isReady, sidList, okSet]);

  const pendingList = useMemo(() => {
    if (isReady) return [] as number[];
    return sidList.filter((sid) => !okSet.has(sid));
  }, [isReady, sidList, okSet]);

  // Метрики
  const duplicatesCount = useMemo(() => {
    let d = 0;
    okSidCounts.forEach((n) => {
      if (n > 1) d++;
    });
    return d;
  }, [okSidCounts]);

  const invalidSigCount = useMemo(() => {
    let c = 0;
    const sigByOkSid = new Map<number, string[]>();
    for (const card of batchResult?.cards ?? []) {
      for (const ctx of card.contexts ?? []) {
        if (typeof ctx.sid === 'number' && typeof ctx.sig === 'string') {
          const arr = sigByOkSid.get(ctx.sid) ?? [];
          arr.push(ctx.sig);
          sigByOkSid.set(ctx.sid, arr);
        }
      }
    }
    sigByOkSid.forEach((arr, sid) => {
      const expected = sigBySid.get(sid);
      if (!expected) return;
      if (!arr.some((s) => s === expected)) c++;
    });
    return c;
  }, [batchResult, sigBySid]);

  const emptyCount = useMemo(() => {
    let c = 0;
    for (const card of batchResult?.cards ?? []) {
      for (const ctx of card.contexts ?? []) {
        if (typeof ctx.sid === 'number') {
          if (!ctx.ru || !ctx.ru.trim()) c++;
        }
      }
    }
    return c;
  }, [batchResult]);

  const missingCount = useMemo(() => {
    if (!isReady) {
      return sidList.filter((sid) => !okSet.has(sid)).length;
    }
    return 0; // в ready missing нет — это failed
  }, [isReady, sidList, okSet]);

  // Таблица по каждому SID: lv/ru/status
  const sidRows = useMemo(() => {
    const lvBySid = new Map(manifest?.items.map((i) => [i.sid, i.lv]) ?? []);
    const ruBySid = new Map<number, string>();
    for (const card of batchResult?.cards ?? []) {
      for (const ctx of card.contexts ?? []) {
        if (typeof ctx.sid === 'number' && typeof ctx.ru === 'string' && ctx.ru.trim()) {
          if (!ruBySid.has(ctx.sid)) ruBySid.set(ctx.sid, ctx.ru);
        }
      }
    }
    return sidList.map((sid): { sid: number; lv: string; ru: string; status: RowStatus } => ({
      sid,
      lv: lvBySid.get(sid) ?? '',
      ru: ruBySid.get(sid) ?? '',
      status: failedSet.has(sid) ? 'failed' : okSet.has(sid) ? 'ok' : 'pending',
    }));
  }, [manifest, batchResult, sidList, okSet, failedSet]);

  // Fallback прогресса — на случай, если хук показывает 0
  const progressFallback = sidList.length ? okSet.size / sidList.length : 0;
  const progressDisplay = Math.max(progress ?? 0, progressFallback);

  // Fallback счётчиков
  const countsFallback = {
    ok: okSet.size,
    failed: failedSet.size,
    pending: pendingList.length,
  };

  // ---------------------------------
  // Экспорт результатов в JSON-файл
  // ---------------------------------
  const onExportJson = () => {
    try {
      const payload = {
        // тех.мета
        timestamp: new Date().toISOString(),
        app: {
          appVersion: (import.meta as any)?.env?.VITE_APP_VERSION ?? 'dev',
          schema: { batchResultVersion: 1, exportSchemaVersion: 1 },
        },

        // запуск
        batchId: manifest?.batchId ?? null,
        params: { maxPerChunk },
        fsm: fsmState.batchState,
        progress: Number((progressDisplay * 100).toFixed(0)),

        // вход
        input: { lvTextRaw: lvInput },

        // манифест (snapshot для последующих проверок, MANIFEST-FIRST)
        manifest: manifest
          ? {
              version: manifest.version,
              createdAt: manifest.createdAt,
              items: manifest.items.map((it) => ({
                sid: it.sid,
                sig: it.sig,
                chunkIndex: it.chunkIndex,
                lv: it.lv,
              })),
            }
          : null,

        // агрегированные показатели
        manifestStats: {
          totalSentences: stats?.totalSentences ?? 0,
          totalChunks: stats?.totalChunks ?? 0,
          maxChunkSize: stats?.maxChunkSize ?? 0,
          avgPerChunk: Number((stats?.avgSentencesPerChunk ?? 0).toFixed(2)),
        },
        metrics: {
          totalSid: sidList.length,
          ok: countsFallback.ok,
          failed: countsFallback.failed,
          pending: countsFallback.pending,
          duplicates: duplicatesCount,
          invalidSig: invalidSigCount,
          empty: emptyCount,
          missing: missingCount,
          // распределение по чанкам — полезно для будущих оптимизаций
          byChunk: manifest
            ? Array.from(
                manifest.items.reduce(
                  (m, it) => m.set(it.chunkIndex, (m.get(it.chunkIndex) ?? 0) + 1),
                  new Map<number, number>(),
                ),
              ).map(([chunk, size]) => ({ chunk, size }))
            : [],
        },

        // диагностика по каждому SID
        sidRows,

        // итог
        result: {
          lvText: batchResult?.lvText ?? '',
          ruText: batchResult?.ruText ?? '',
          cards: batchResult?.cards ?? [],
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `flashcards3_batch_${manifest?.batchId ?? 'noid'}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>Batch Playground (flashcards3)</h1>

      <section style={styles.card}>
        <h2 style={styles.h2}>1) Ввод LV текста → Манифест</h2>
        <label style={styles.label}>Латышский текст (LV):</label>
        <textarea
          style={styles.textarea}
          rows={6}
          value={lvInput}
          onChange={(e) => setLvInput(e.target.value)}
          placeholder="Ierakstiet teikumus latviski..."
        />
        <div style={styles.row}>
          <label style={styles.labelInline}>Макс. предложений на чанк:</label>
          <input
            style={styles.input}
            type="number"
            min={1}
            value={maxPerChunk}
            onChange={(e) => setMaxPerChunk(Number(e.target.value))}
          />
          <button style={styles.btn} onClick={onBuildManifest}>
            Сгенерировать манифест
          </button>
        </div>

        {manifest && (
          <div style={styles.meta}>
            <b>Манифест:</b> batchId=<code>{manifest.batchId}</code>, всего предложений=
            <b>{stats?.totalSentences}</b>, чанков=<b>{stats?.totalChunks}</b>, maxSize=
            <b>{stats?.maxChunkSize}</b>, avg/chunk=<b>{stats?.avgSentencesPerChunk.toFixed(2)}</b>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>2) Оркестрация батча (FSM)</h2>
        <div style={styles.rowWrap}>
          <button style={styles.btn} disabled={!canStart} onClick={onStart}>
            ▶ Запустить
          </button>
          <button style={styles.btn} disabled={!canCancel} onClick={onCancel}>
            ✖ Отменить
          </button>
          <button style={styles.btn} onClick={onReset}>
            ↺ Сброс
          </button>
          <button style={styles.btn} disabled={!batchResult} onClick={onExportJson}>
            ⬇ Экспорт JSON
          </button>
        </div>

        <div style={styles.meta}>
          <div>
            <b>Состояние батча:</b> {fsmState.batchState}
          </div>
          <div>
            <b>Прогресс:</b> {(progressDisplay * 100).toFixed(0)}%
          </div>
          <div>
            <b>SID:</b> ok={<b>{countsFallback.ok}</b>},&nbsp; failed=
            {<b>{countsFallback.failed}</b>},&nbsp; pending={<b>{countsFallback.pending}</b>}
          </div>
          <div>
            <b>Processing time (accum):</b> {processingTime} ms
          </div>
        </div>

        {errorMsg && <div style={styles.error}>Ошибка: {errorMsg}</div>}
        {isProcessing && (
          <div style={styles.info}>Идёт обработка… polling до готовности (HTTP 202 → 200).</div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>3) Результат (агрегация по SID)</h2>
        {!batchResult && (
          <div style={styles.info}>Результат пока отсутствует. Запустите обработку.</div>
        )}
        {batchResult && (
          <>
            <div style={styles.rowCols}>
              <div style={styles.col}>
                <h3 style={styles.h3}>LV (из манифеста)</h3>
                <pre style={styles.pre}>{batchResult.lvText}</pre>
              </div>
              <div style={styles.col}>
                <h3 style={styles.h3}>RU (по порядку SID)</h3>
                <pre style={styles.pre}>{batchResult.ruText}</pre>
              </div>
            </div>
            <div style={styles.meta}>
              <b>Флэшкарточек:</b> {batchResult.cards.length}
            </div>

            <div style={styles.meta}>
              <h3 style={styles.h3}>Метрики агрегатора</h3>
              <ul style={{ margin: '6px 0 0 16px' }}>
                <li>
                  Всего SID по манифесту: <b>{sidList.length}</b>
                </li>
                <li>
                  OK: <b>{countsFallback.ok}</b>, Failed: <b>{countsFallback.failed}</b>, Pending:{' '}
                  <b>{countsFallback.pending}</b>
                </li>
                <li>
                  Duplicates (по SID в контекстах): <b>{duplicatesCount}</b>
                </li>
                <li>
                  Invalid SIG: <b>{invalidSigCount}</b>
                </li>
                <li>
                  Empty RU: <b>{emptyCount}</b>
                </li>
                <li>
                  Missing (нет ни в контекстах, ни в errors): <b>{missingCount}</b>
                </li>
              </ul>
            </div>
          </>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>4) Диагностика по SID</h2>
        {!manifest && <div style={styles.info}>Сначала сгенерируйте манифест.</div>}
        {manifest && (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>SID</th>
                  <th style={styles.th}>Статус</th>
                  <th style={styles.th}>LV</th>
                  <th style={styles.th}>RU</th>
                </tr>
              </thead>
              <tbody>
                {sidRows.map((row) => (
                  <tr key={row.sid}>
                    <td style={styles.tdMono}>{row.sid}</td>
                    <td style={{ ...styles.td, ...statusStyle(row.status) }}>
                      {row.status === 'ok' && '🟢 ok'}
                      {row.status === 'failed' && '🔴 failed'}
                      {row.status === 'pending' && '🟡 pending'}
                    </td>
                    <td style={styles.td}>{row.lv}</td>
                    <td style={styles.td}>{row.ru}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <small>Принципы: MANIFEST-FIRST • SID-AGG • FSM • Strict DTO (Zod)</small>
      </footer>
    </div>
  );
}

function statusStyle(status: RowStatus): React.CSSProperties {
  if (status === 'ok') return { color: '#065f46' };
  if (status === 'failed') return { color: '#991b1b' };
  return { color: '#92400e' };
}

// Простой inline-стайл, без зависимостей
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 980,
    margin: '24px auto',
    padding: '0 16px',
    fontFamily: 'system-ui, sans-serif',
  },
  h1: { fontSize: 28, margin: '8px 0 16px' },
  h2: { fontSize: 20, margin: '0 0 12px' },
  h3: { fontSize: 16, margin: '0 0 8px' },
  card: { border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 },
  label: { display: 'block', fontWeight: 600, marginBottom: 6 },
  labelInline: { marginRight: 8, fontWeight: 600 },
  textarea: {
    width: '100%',
    fontFamily: 'monospace',
    padding: 8,
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  input: {
    width: 90,
    marginRight: 12,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 },
  rowWrap: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  col: { minWidth: 0 },
  btn: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    background: '#f8fafc',
    cursor: 'pointer',
  },
  pre: {
    whiteSpace: 'pre-wrap',
    background: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    border: '1px solid #eef2f7',
    minHeight: 60,
  },
  meta: { marginTop: 10, fontSize: 14, color: '#374151' },
  info: { marginTop: 8, fontSize: 14, color: '#2563eb' },
  error: { marginTop: 8, fontSize: 14, color: '#dc2626' },
  footer: { textAlign: 'center', marginTop: 24, color: '#6b7280' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #e5e7eb',
    padding: '6px 8px',
    whiteSpace: 'nowrap',
  },
  td: { borderBottom: '1px solid #f3f4f6', padding: '6px 8px', verticalAlign: 'top' },
  tdMono: { borderBottom: '1px solid #f3f4f6', padding: '6px 8px', fontFamily: 'monospace' },
};
