"use client";

import { useEffect } from 'react';
import { useFeatureData } from '@/app/admin/components/FeatureShared';

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
