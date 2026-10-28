"use client";
import { loadProfilePhotoUrl } from '@/business/shared/accounts/profile';

/**
 * Turns a stored avatar path into a temporary signed image URL.
 * The hook refreshes the URL without making the storage object public and ignores obsolete
 * requests.
 */

import { useEffect, useState } from "react";

/** One shared URL keeps the header and profile editor on the same saved photo. */
export function useProfilePhotoUrl(path: string | null | undefined, savedPreview: string | null) {
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    const photoPath = path;
    let active = true;
    let requestId = 0;
    async function load() {
      const id = ++requestId;
      try {
        const { data, error } = await loadProfilePhotoUrl(photoPath);
        if (active && id === requestId && data && !error) setSigned({ path: photoPath, url: data.signedUrl });
      } catch { /* Keep the saved preview or initials while offline. */ }
    }
    void load();
    const timer = window.setInterval(() => void load(), 45 * 60_000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); };
  }, [path]);
  if (!path) return null;
  return signed?.path === path ? signed.url : savedPreview;
}
