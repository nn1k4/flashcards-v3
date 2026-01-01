import { useCallback, useEffect, useRef } from 'react';
import type { HotkeyAction } from '../types/config/flashcards';

export type HotkeyActions = Record<HotkeyAction, () => void>;
export type HotkeyConfig = Record<string, HotkeyAction>;

/**
 * Custom hook for handling keyboard shortcuts.
 * Config-driven: maps key codes to actions.
 *
 * @param actions - Object mapping action names to handler functions
 * @param config - Object mapping key codes (e.g., "ArrowRight", " ") to action names
 * @param enabled - Whether hotkeys are active (default: true)
 */
export function useHotkeys(
  actions: HotkeyActions,
  config: HotkeyConfig,
  enabled: boolean = true,
): void {
  // Use refs to avoid stale closures
  const actionsRef = useRef(actions);
  const configRef = useRef(config);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const action = configRef.current[event.key];
      if (action && actionsRef.current[action]) {
        event.preventDefault();
        actionsRef.current[action]();
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
