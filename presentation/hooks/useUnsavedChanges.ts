"use client";

/**
 * Registers a dirty form with the shared navigation guard.
 * Both browser unloads and in-app navigation can ask before discarding the draft.
 */

import { useEffect } from 'react';
import { registerUnsavedForm } from '@/presentation/navigation/unsaved';

/** Local tab changes use the returned confirmation; page navigation shares a single guard. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    return registerUnsavedForm();
  }, [dirty]);
  return () => !dirty || window.confirm('Discard your unsaved changes?');
}
