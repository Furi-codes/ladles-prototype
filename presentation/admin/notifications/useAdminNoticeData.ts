"use client";

/**
 * Loads the shared admin notification state for the bell and inbox.
 * Focus, timer and local change events refresh the count without requiring a page reload.
 */

import { useEffect } from 'react';
import { adminNoticesChanged } from '@/business/admin/services/notifications';
import { useFeatureData } from '@/presentation/components/ui/FeatureShared';

/** No publication/Realtime setup is required. Refresh on focus, local reads and visible polling. */
export function useAdminNoticeData<T>(loader: () => Promise<T>) {
  const result = useFeatureData(loader), { reload } = result;
  useEffect(() => {
    const refresh = () => { void reload(); };
    const timer = window.setInterval(() => { if (typeof document==='undefined' || document.visibilityState!=='hidden') refresh(); }, 30000);
    window.addEventListener('focus', refresh); window.addEventListener(adminNoticesChanged, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener(adminNoticesChanged, refresh); };
  }, [reload]);
  return result;
}
