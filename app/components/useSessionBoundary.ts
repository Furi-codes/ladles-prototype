"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Hide cached account data if another tab signs out or changes the signed-in identity. */
export function useSessionBoundary(enabled: boolean) {
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let identity: string | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // This is a display boundary, not authorization. Database policies still check every request.
      // Keep this callback synchronous: do not call other Auth methods from inside it.
      if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' && !session) setEnded(true);
      if (session?.user) {
        if (identity && identity !== session.user.id) setEnded(true);
        identity = session.user.id;
      }
    });
    return () => subscription.unsubscribe();
  }, [enabled]);
  return ended;
}
