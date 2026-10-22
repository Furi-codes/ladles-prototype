"use client";

import { useEffect } from 'react';
import { registerUnsavedForm } from '@/lib/unsaved-navigation';

/** Local tab changes use the returned confirmation; page navigation shares a single guard. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    return registerUnsavedForm();
  }, [dirty]);
  return () => !dirty || window.confirm('Discard your unsaved changes?');
}
