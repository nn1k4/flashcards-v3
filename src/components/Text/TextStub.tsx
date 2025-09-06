import React from 'react';
import { useBatchPipeline } from '../../hooks/useBatch';

export default function TextStub() {
  const [text, setText] = React.useState('Sveiki! Es mācos latviešu valodu.');
  const { submit, cancel, fsmState, isBusy, isFailed, isDone, progress } = useBatchPipeline(20);

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
        <span className="text-xs opacity-75">
          state: {fsmState.batchState} • progress: {Math.round((progress ?? 0) * 100)}%
          {isFailed ? ' • failed' : ''}
          {isDone ? ' • done' : ''}
        </span>
      </div>
    </div>
  );
}
