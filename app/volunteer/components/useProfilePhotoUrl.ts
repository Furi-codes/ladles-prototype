"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET } from "@/lib/avatar";

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
        const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(photoPath, 3600);
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
