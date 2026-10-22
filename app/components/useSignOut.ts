"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { confirmUnsavedNavigation } from '@/lib/unsaved-navigation';

/** Do not send somebody to the login screen while their sign-out request has failed. */
export function useSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  async function signOut() {
    if (pending.current || !confirmUnsavedNavigation()) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.auth.signOut();
      if (failure) throw failure;
      router.replace('/');
    } catch { setError('Sign-out could not be completed. Please check your connection and try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return { signOut, busy, error };
}
