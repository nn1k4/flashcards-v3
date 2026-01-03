import React from 'react';
import { apiClient } from '../../api/client';
import { callMessagesViaProxy } from '../../api/tools';
import { config as appConfig } from '../../config';
import { useBatchPipeline } from '../../hooks/useBatch';
import { useFlashcards } from '../../hooks/useFlashcards';
import { useLLMToolsEmitter } from '../../hooks/useLLMToolsEmitter';
import { useMessageBatches } from '../../hooks/useMessageBatches';
import { useBatchHistoryStore, type BatchHistoryItem } from '../../stores/batchHistoryStore';
import type { Flashcard } from '../../types/dto';
import { ZEmitFlashcardsInput } from '../../types/tool_use';
import { buildManifestWithEngine } from '../../utils/manifest';
import { invokeWithMaxTokensBump } from '../../utils/tooluse';
import { FlashcardsView } from '../Flashcards';

type ProcessingMode = 'single' | 'mock-batch' | 'message-batches';

// Status badge component
function StatusBadge({ status }: { status: BatchHistoryItem['status'] }) {
  const colors: Record<BatchHistoryItem['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    ended: 'bg-green-100 text-green-800',
    canceling: 'bg-orange-100 text-orange-800',
    failed: 'bg-red-100 text-red-800',
  };

  const labels: Record<BatchHistoryItem['status'], string> = {
    pending: 'Pending',
    in_progress: 'Processing',
    ended: 'Completed',
    canceling: 'Canceling',
    failed: 'Failed',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

// Batch history item component
function BatchHistoryRow({
  item,
  onCancel,
}: {
  item: BatchHistoryItem;
  onCancel: (id: string) => void;
}) {
  const canCancel = item.status === 'pending' || item.status === 'in_progress';
  const progress =
    item.requestCounts && item.requestCounts.total > 0
      ? ((item.requestCounts.succeeded + item.requestCounts.errored) / item.requestCounts.total) *
        100
      : 0;

  return (
    <div className="p-2 border-b last:border-b-0 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate" title={item.name}>
              {item.name}
            </span>
            <StatusBadge status={item.status} />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {item.manifestItemCount} items
            {item.requestCounts && (
              <>
                {' | '}
                {item.requestCounts.succeeded} ok, {item.requestCounts.errored} err
              </>
            )}
            {item.status === 'in_progress' && ` | ${Math.round(progress)}%`}
          </div>
        </div>
        {canCancel && (
          <button
            onClick={() => onCancel(item.id)}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Cancel
          </button>
        )}
      </div>
      {item.error && <div className="text-xs text-red-600 mt-1">{item.error}</div>}
    </div>
  );
}

export default function TextStub() {
  const [text, setText] = React.useState('Sveiki! Es mācos latviešu valodu.');
  const [mode, setMode] = React.useState<ProcessingMode>('single');
  const [showFlashcards, setShowFlashcards] = React.useState(false);

  // Mock batch (legacy)
  const mockBatch = useBatchPipeline(20);

  // Official Message Batches API
  const messageBatches = useMessageBatches();

  // Single tool-use
  const [singleBusy, setSingleBusy] = React.useState(false);
  const [singleError, setSingleError] = React.useState<string | null>(null);

  const { setCards, totalVisible } = useFlashcards();
  const { items: batchHistory, updateBatch } = useBatchHistoryStore();

  // Connect mock batch results to FlashcardsView
  React.useEffect(() => {
    if (mode === 'mock-batch' && mockBatch.isDone && mockBatch.batchResult?.cards?.length) {
      console.log('[TextStub] Mock batch complete, cards:', mockBatch.batchResult.cards.length);
      setCards(mockBatch.batchResult.cards);
      setShowFlashcards(true);
    }
  }, [mode, mockBatch.isDone, mockBatch.batchResult, setCards]);

  // Connect Message Batches results to FlashcardsView
  React.useEffect(() => {
    if (
      mode === 'message-batches' &&
      messageBatches.isComplete &&
      messageBatches.flashcards.length
    ) {
      console.log('[TextStub] Message Batches complete, cards:', messageBatches.flashcards.length);
      setCards(messageBatches.flashcards);
      setShowFlashcards(true);
    }
  }, [mode, messageBatches.isComplete, messageBatches.flashcards, setCards]);

  const emitter = useLLMToolsEmitter<{ flashcards: Flashcard[] }>({
    callMessages: callMessagesViaProxy,
    schema: ZEmitFlashcardsInput as any,
  });

  const onSingleToolUse = async () => {
    setSingleError(null);
    setSingleBusy(true);
    setShowFlashcards(false);
    try {
      console.log('[TextStub] Starting single tool-use...');
      const req = {
        model: appConfig.llm.defaultModel,
        system: { type: 'text', text: 'Return strictly structured JSON via emit_flashcards tool.' },
        messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        tools: [],
        tool_choice: { type: 'tool', name: 'emit_flashcards' },
        disable_parallel_tool_use: true,
        max_tokens: appConfig.llm.maxTokensDefault,
      } as const;
      const res = await invokeWithMaxTokensBump((r) => emitter.invoke(r as any), req as any, {
        attempts: 2,
      });
      if (!res.ok) throw new Error(res.stopReason || 'tool-use failed');
      const cards = res.data.flashcards ?? [];
      console.log('[TextStub] Single tool-use complete, cards:', cards.length);
      setCards(cards);
      if (cards.length > 0) {
        setShowFlashcards(true);
      }
    } catch (e) {
      console.error('[TextStub] Single tool-use error:', e);
      setSingleError(e instanceof Error ? e.message : String(e));
    } finally {
      setSingleBusy(false);
    }
  };

  const onSubmit = async () => {
    console.log(`[TextStub] Submit with mode: ${mode}`);
    setShowFlashcards(false);

    if (mode === 'single') {
      await onSingleToolUse();
    } else if (mode === 'mock-batch') {
      await mockBatch.submit(text);
    } else if (mode === 'message-batches') {
      const engine = appConfig.nlp?.segmentation?.engine ?? 'primitive';
      const manifest = buildManifestWithEngine(text, 20, engine as any);
      const batchName = `${text.slice(0, 25)}${text.length > 25 ? '...' : ''}`;
      await messageBatches.submitBatch(manifest, batchName);
    }
  };

  const onCancel = () => {
    if (mode === 'mock-batch') {
      mockBatch.cancel();
    } else if (mode === 'message-batches') {
      messageBatches.cancelBatch();
    }
  };

  const handleCancelHistoryItem = async (batchId: string) => {
    try {
      console.log(`[TextStub] Canceling batch from history: ${batchId}`);
      await apiClient.cancelMessageBatch(batchId);
      updateBatch(batchId, { status: 'canceling' });
    } catch (e) {
      console.error('[TextStub] Cancel error:', e);
    }
  };

  const isBusy =
    (mode === 'single' && singleBusy) ||
    (mode === 'mock-batch' && mockBatch.isBusy) ||
    (mode === 'message-batches' && messageBatches.isProcessing);

  const currentError =
    (mode === 'single' && singleError) || (mode === 'message-batches' && messageBatches.error);

  const currentStatus = () => {
    if (mode === 'single') {
      return singleBusy ? 'processing...' : singleError ? 'error' : 'idle';
    }
    if (mode === 'mock-batch') {
      return `${mockBatch.fsmState.batchState} | ${Math.round((mockBatch.progress ?? 0) * 100)}%`;
    }
    if (mode === 'message-batches') {
      if (messageBatches.isProcessing)
        return `processing | ${Math.round(messageBatches.progress * 100)}%`;
      if (messageBatches.isComplete) return 'complete';
      if (messageBatches.isFailed) return 'failed';
      return 'idle';
    }
    return 'idle';
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Main input section */}
      <div className="border rounded-md p-3 bg-white">
        <label htmlFor="text-stub-input" className="text-sm block mb-1 font-medium">
          Latvian Text
        </label>
        <textarea
          id="text-stub-input"
          className="w-full border rounded p-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />

        {/* Mode Selection */}
        <div className="mt-3 p-2 bg-gray-50 rounded">
          <span className="text-sm font-medium mr-3">Processing Mode:</span>
          <div className="inline-flex gap-4 mt-1">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="single"
                checked={mode === 'single'}
                onChange={() => setMode('single')}
                className="w-4 h-4"
              />
              <span>Single</span>
              <span className="text-xs text-gray-500">(direct API)</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="mock-batch"
                checked={mode === 'mock-batch'}
                onChange={() => setMode('mock-batch')}
                className="w-4 h-4"
              />
              <span>Mock Batch</span>
              <span className="text-xs text-gray-500">(local)</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="message-batches"
                checked={mode === 'message-batches'}
                onChange={() => setMode('message-batches')}
                className="w-4 h-4"
              />
              <span>Message Batches</span>
              <span className="text-xs text-green-600 font-medium">(50% off)</span>
            </label>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          <button
            aria-label="Submit"
            onClick={onSubmit}
            className="px-4 py-1.5 rounded bg-blue-600 text-white font-medium disabled:opacity-50 hover:bg-blue-700"
            disabled={isBusy}
          >
            {mode === 'message-batches' ? 'Submit Batch' : 'Submit'}
          </button>
          <button
            aria-label="Cancel"
            onClick={onCancel}
            className="px-4 py-1.5 rounded bg-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-300"
            disabled={!isBusy}
          >
            Cancel
          </button>
          <span className="text-sm text-gray-500 ml-2">Status: {currentStatus()}</span>
        </div>

        {/* Error Display */}
        {currentError && (
          <div className="mt-2 p-2 text-sm text-red-700 bg-red-50 rounded">
            Error: {currentError}
          </div>
        )}

        {/* Current Batch Info for Message Batches mode */}
        {mode === 'message-batches' && messageBatches.currentBatch && (
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
            <div className="text-sm font-medium text-blue-900">Current Batch</div>
            <div className="mt-1 text-xs text-blue-800 space-y-0.5">
              <div>
                <span className="font-medium">ID:</span> {messageBatches.currentBatch.batchId}
              </div>
              <div>
                <span className="font-medium">Status:</span>{' '}
                <StatusBadge
                  status={messageBatches.currentBatch.status === 'ended' ? 'ended' : 'in_progress'}
                />
              </div>
              {messageBatches.currentBatch.requestCounts && (
                <div>
                  <span className="font-medium">Progress:</span>{' '}
                  {messageBatches.currentBatch.requestCounts.succeeded}/
                  {messageBatches.currentBatch.requestCounts.total} succeeded,{' '}
                  {messageBatches.currentBatch.requestCounts.errored} errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flashcards */}
        {totalVisible > 0 && (
          <div className="mt-3 text-sm">
            <b>Flashcards:</b> {totalVisible} cards loaded
            {!showFlashcards && (
              <button
                type="button"
                onClick={() => setShowFlashcards(true)}
                className="ml-2 text-blue-600 underline"
              >
                Show
              </button>
            )}
            {showFlashcards && (
              <button
                type="button"
                onClick={() => setShowFlashcards(false)}
                className="ml-2 text-blue-600 underline"
              >
                Hide
              </button>
            )}
          </div>
        )}
        {showFlashcards && <FlashcardsView />}
      </div>

      {/* Batch History - only show for message-batches mode */}
      {mode === 'message-batches' && (
        <div className="border rounded-md bg-white">
          <div className="p-3 border-b bg-gray-50">
            <h3 className="text-sm font-medium">Batch History (Last 10)</h3>
          </div>
          {batchHistory.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No batches sent yet</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {batchHistory.map((item) => (
                <BatchHistoryRow key={item.id} item={item} onCancel={handleCancelHistoryItem} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
