import React from 'react';
import { callMessagesViaProxy } from '../../api/tools';
import { config as appConfig } from '../../config';
import { useBatchPipeline } from '../../hooks/useBatch';
import { useFlashcards } from '../../hooks/useFlashcards';
import { useLLMToolsEmitter } from '../../hooks/useLLMToolsEmitter';
import type { Flashcard } from '../../types/dto';
import { ZEmitFlashcardsInput } from '../../types/tool_use';
import { invokeWithMaxTokensBump } from '../../utils/tooluse';
import { FlashcardsView } from '../Flashcards';

export default function TextStub() {
  const [text, setText] = React.useState('Sveiki! Es mācos latviešu valodu.');
  const { submit, cancel, fsmState, isBusy, isFailed, isDone, progress } = useBatchPipeline(20);
  const [singleBusy, setSingleBusy] = React.useState(false);
  const [singleError, setSingleError] = React.useState<string | null>(null);
  const [showFlashcards, setShowFlashcards] = React.useState(false);
  const { setCards, totalVisible } = useFlashcards();

  const emitter = useLLMToolsEmitter<{ flashcards: Flashcard[] }>({
    callMessages: callMessagesViaProxy,
    schema: ZEmitFlashcardsInput as any,
  });

  const onSingleToolUse = async () => {
    setSingleError(null);
    setSingleBusy(true);
    setShowFlashcards(false);
    try {
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
      setCards(cards);
      if (cards.length > 0) {
        setShowFlashcards(true);
      }
    } catch (e) {
      setSingleError(e instanceof Error ? e.message : String(e));
    } finally {
      setSingleBusy(false);
    }
  };

  return (
    <div className="mt-6 border rounded-md p-3">
      <label htmlFor="text-stub-input" className="text-sm block mb-1">
        LV Text
      </label>
      <textarea
        id="text-stub-input"
        className="w-full border rounded p-2 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          aria-label="Submit Text"
          onClick={() => submit(text)}
          className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={isBusy}
        >
          Submit
        </button>
        <button
          aria-label="Cancel"
          onClick={() => cancel()}
          className="px-3 py-1 rounded bg-neutral-200"
        >
          Cancel
        </button>
        <button
          aria-label="Single Tool Use"
          onClick={onSingleToolUse}
          className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-50"
          disabled={singleBusy}
        >
          Tool-use (single)
        </button>
        <span className="text-xs opacity-75">
          state: {fsmState.batchState} • progress: {Math.round((progress ?? 0) * 100)}%
          {isFailed ? ' • failed' : ''}
          {isDone ? ' • done' : ''}
        </span>
      </div>
      {/* Single tool-use result */}
      {singleError && <div className="mt-2 text-sm text-red-600">Error: {singleError}</div>}
      {totalVisible > 0 && (
        <div className="mt-2 text-sm">
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
  );
}
