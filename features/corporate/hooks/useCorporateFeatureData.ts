"use client";
/**
 * Adds an optional foreground refresh to the shared feature-data loader.
 * Callers can turn focus refresh off while editing; the shared loader ignores obsolete
 * responses.
 */

import { useEffect } from 'react';
import { useFeatureData } from '@/components/ui/FeatureShared';

/** Pages load fresh rows on entry and when the browser returns to the foreground. */
export function useCorporateFeatureData<T>(loader: () => Promise<T>, refreshOnFocus = true) {
  const result = useFeatureData(loader);
  const { reload } = result;
  useEffect(() => {
    if (!refreshOnFocus) return;
    const refresh = () => { void reload(); };
    if (typeof window !== 'undefined') window.addEventListener('focus', refresh);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('focus', refresh); };
  }, [reload, refreshOnFocus]);
  return result;
}
