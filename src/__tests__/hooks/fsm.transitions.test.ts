import { describe, expect, it } from 'vitest';
import { batchFSMReducer, createInitialBatchState, FSMFlags, FSMSelectors } from '../../utils/fsm';

describe('FSM transitions: happy, cancel, failed (S2)', () => {
  it('happy path: idle -> submitted -> in_progress -> ready', () => {
    let s = createInitialBatchState(3, 1);
    expect(FSMFlags.isIdle(s)).toBe(true);
    s = batchFSMReducer(s, { type: 'SUBMIT_BATCH' });
    expect(s.batchState).toBe('submitted');
    s = batchFSMReducer(s, { type: 'BATCH_STARTED' });
    expect(s.batchState).toBe('in_progress');
    // receive sids
    s = batchFSMReducer(s, { type: 'SID_RECEIVED', payload: { sid: 0 } });
    s = batchFSMReducer(s, { type: 'SID_RECEIVED', payload: { sid: 1 } });
    s = batchFSMReducer(s, { type: 'SID_RECEIVED', payload: { sid: 2 } });
    // complete
    s = batchFSMReducer(s, { type: 'BATCH_COMPLETED' });
    expect(FSMFlags.isDone(s)).toBe(true);
    expect(FSMSelectors.getProgress(s)).toBeCloseTo(1, 5);
  });

  it('cancel (reset) returns to idle and clears timers', () => {
    let s = createInitialBatchState(2, 1);
    s = batchFSMReducer(s, { type: 'SUBMIT_BATCH' });
    s = batchFSMReducer(s, { type: 'BATCH_STARTED' });
    s = batchFSMReducer(s, { type: 'RESET' });
    expect(FSMFlags.isIdle(s)).toBe(true);
    expect(s.processedChunks.size).toBe(0);
  });

  it('failed transition sets failed and records error', () => {
    let s = createInitialBatchState(1, 1);
    s = batchFSMReducer(s, { type: 'SUBMIT_BATCH' });
    s = batchFSMReducer(s, { type: 'BATCH_FAILED', payload: { error: 'boom' } });
    expect(FSMFlags.isFailed(s)).toBe(true);
    expect(s.errors.length).toBeGreaterThan(0);
  });
});
