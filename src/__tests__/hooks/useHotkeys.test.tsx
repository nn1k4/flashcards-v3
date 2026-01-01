import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HotkeyActions, HotkeyConfig } from '../../hooks/useHotkeys';
import { useHotkeys } from '../../hooks/useHotkeys';

describe('useHotkeys', () => {
  const createActions = (): HotkeyActions => ({
    next: vi.fn(),
    prev: vi.fn(),
    flip: vi.fn(),
    hide: vi.fn(),
  });

  const defaultConfig: HotkeyConfig = {
    ArrowRight: 'next',
    ArrowLeft: 'prev',
    ' ': 'flip',
    h: 'hide',
  };

  const fireKeyDown = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    window.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls action when corresponding key is pressed', () => {
    const actions = createActions();
    renderHook(() => useHotkeys(actions, defaultConfig));

    fireKeyDown('ArrowRight');
    expect(actions.next).toHaveBeenCalledTimes(1);

    fireKeyDown('ArrowLeft');
    expect(actions.prev).toHaveBeenCalledTimes(1);

    fireKeyDown(' ');
    expect(actions.flip).toHaveBeenCalledTimes(1);

    fireKeyDown('h');
    expect(actions.hide).toHaveBeenCalledTimes(1);
  });

  it('does not call action for unmapped keys', () => {
    const actions = createActions();
    renderHook(() => useHotkeys(actions, defaultConfig));

    fireKeyDown('x');
    fireKeyDown('Enter');
    fireKeyDown('Escape');

    expect(actions.next).not.toHaveBeenCalled();
    expect(actions.prev).not.toHaveBeenCalled();
    expect(actions.flip).not.toHaveBeenCalled();
    expect(actions.hide).not.toHaveBeenCalled();
  });

  it('does not call action when disabled', () => {
    const actions = createActions();
    renderHook(() => useHotkeys(actions, defaultConfig, false));

    fireKeyDown('ArrowRight');
    expect(actions.next).not.toHaveBeenCalled();
  });

  it('respects custom config mapping', () => {
    const actions = createActions();
    const customConfig: HotkeyConfig = {
      n: 'next',
      p: 'prev',
      f: 'flip',
    };
    renderHook(() => useHotkeys(actions, customConfig));

    fireKeyDown('n');
    expect(actions.next).toHaveBeenCalledTimes(1);

    fireKeyDown('p');
    expect(actions.prev).toHaveBeenCalledTimes(1);

    // ArrowRight should not work with custom config
    fireKeyDown('ArrowRight');
    expect(actions.next).toHaveBeenCalledTimes(1); // still 1
  });

  it('removes listener on unmount', () => {
    const actions = createActions();
    const { unmount } = renderHook(() => useHotkeys(actions, defaultConfig));

    fireKeyDown('ArrowRight');
    expect(actions.next).toHaveBeenCalledTimes(1);

    unmount();

    fireKeyDown('ArrowRight');
    expect(actions.next).toHaveBeenCalledTimes(1); // still 1
  });

  it('skips action when target is an input element', () => {
    const actions = createActions();
    renderHook(() => useHotkeys(actions, defaultConfig));

    // Create an input element and simulate keydown on it
    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(actions.next).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('skips action when target is a textarea element', () => {
    const actions = createActions();
    renderHook(() => useHotkeys(actions, defaultConfig));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(actions.next).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });
});
