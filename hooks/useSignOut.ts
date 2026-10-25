"use client";
/**
 * Runs the shared sign-out flow and reports failure to the current screen.
 * A pending guard prevents duplicate requests, and redirecting happens only after successful
 * sign-out.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { confirmUnsavedNavigation } from '@/lib/navigation/unsaved';

/** Do not send somebody to the login screen while their sign-out request has failed. */
export function useSignOut({ onSignedOut, redirectTo = '/' }: { onSignedOut?: () => void; redirectTo?: string } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  async function signOut() {
    if (pending.current || !confirmUnsavedNavigation()) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.auth.signOut();
      if (failure) throw failure;
      // A registration screen can clear its local session state and keep its intended destination.
      onSignedOut?.();
      router.replace(redirectTo);
    } catch { setError('Sign-out could not be completed. Please check your connection and try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return { signOut, busy, error };
}
