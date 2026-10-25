"use client";
/**
 * Shares the business account, session checks, settings and photo across corporate pages.
 * Recent checks are reused and concurrent refreshes share one request; identity changes clear
 * cached private data.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { corporateBookingsEnabled } from '@/lib/config/features';
import { hasAuthLinkError } from '@/lib/auth/links';
import { getMyCorporateAccount } from '@/features/corporate/services/accounts';
import { getCorporateBookingSettings } from '@/features/corporate/services/bookings';
import type { CorporateAccount } from '@/features/corporate/types/accounts';
import type { CorporateBookingSettings } from '@/features/corporate/types/bookings';
import { useCorporatePhoto } from '@/features/corporate/accounts/useCorporatePhoto';

interface WorkspaceData {
  userId: string; signInEmail: string; account: CorporateAccount; emailVerified: boolean;
  settings: CorporateBookingSettings | null; settingsError: string;
}
interface WorkspaceContext {
  data: WorkspaceData | null; checking: boolean; refreshing: boolean; error: string; sessionEnded: boolean;
  refreshWorkspace: (force?: boolean) => Promise<void>;
  applyAccount: (account: CorporateAccount) => void;
  photo: ReturnType<typeof useCorporatePhoto>;
}
const Context = createContext<WorkspaceContext | null>(null);
const freshnessMs = 30000;

/** Share account/access checks across pages. The database still checks permissions on every request. */
export function CorporateWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const photo = useCorporatePhoto(data?.userId);
  const [checking, setChecking] = useState(true), [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(''), [sessionEnded, setSessionEnded] = useState(false);
  const sequence = useRef(0), checkedAt = useRef(-Infinity);
  const identity = useRef<string | null>(null), ended = useRef(false);
  const pending = useRef<Promise<void> | null>(null);
  const invalidate = useCallback(() => { ++sequence.current; pending.current = null; }, []);
  const endSession = useCallback(() => {
    ended.current = true; ++sequence.current; pending.current = null; checkedAt.current = -Infinity;
    setData(null); setError(''); setChecking(false); setRefreshing(false); setSessionEnded(true);
  }, []);
  const refreshWorkspace = useCallback((force = false): Promise<void> => {
    if (ended.current || !force && Date.now() - checkedAt.current < freshnessMs) return Promise.resolve();
    if (pending.current) return pending.current;
    const request = ++sequence.current;
    setRefreshing(true); setError('');
    const task = (async () => {
      try {
        if (typeof window!=='undefined' && hasAuthLinkError(window.location.search,window.location.hash)) { setData(null);router.replace('/?verification=expired');return; }
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (request !== sequence.current) return;
        if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
        if (!auth.user) { setData(null); router.replace('/?portal=corporate'); return; }
        if (identity.current && identity.current !== auth.user.id) { endSession(); return; }
        identity.current = auth.user.id;
        const account = await getMyCorporateAccount();
        if (request !== sequence.current) return;
        if (!account) { setData(null); router.replace('/'); return; }
        if (account.owner_user_id !== auth.user.id) { endSession(); return; }
        let settings: CorporateBookingSettings | null = null, settingsError = '';
        if (corporateBookingsEnabled && account.status === 'Approved' && auth.user.email_confirmed_at) {
          try { settings = await getCorporateBookingSettings(); }
          catch (failure) { settingsError = userFacingError(failure, 'Booking settings could not be loaded. Please retry.'); }
        }
        if (request === sequence.current) {
          setData({ userId: auth.user.id, signInEmail: auth.user.email || '', account, emailVerified: Boolean(auth.user.email_confirmed_at), settings, settingsError });
          checkedAt.current = Date.now();
        }
      } catch (failure) {
        if (request === sequence.current) setError(userFacingError(failure instanceof Error ? failure.message : 'Corporate account could not be checked.', "Corporate account could not be checked."));
      } finally {
        if (request === sequence.current) { setChecking(false); setRefreshing(false); }
      }
    })();
    pending.current = task;
    void task.then(() => { if (request === sequence.current) pending.current = null; });
    return task;
  }, [router, endSession]);
  const applyAccount = useCallback((account: CorporateAccount) => {
    // Invalidate a pre-save refresh so it cannot put an old company name back in the header.
    ++sequence.current; pending.current = null; checkedAt.current = -Infinity; setRefreshing(false);
    setData(current => current ? { ...current, account } : null);
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refreshWorkspace(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this synchronous; starting Supabase requests inside this callback can deadlock Auth.
      if (event === 'SIGNED_OUT' || identity.current && (!session && event === 'INITIAL_SESSION' || session?.user && session.user.id !== identity.current)) endSession();
      else if (session?.user && !identity.current) identity.current = session.user.id;
    });
    const focus = () => { void refreshWorkspace(true); };
    if (typeof window !== 'undefined') window.addEventListener('focus', focus);
    return () => {
      active = false; invalidate(); subscription.unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('focus', focus);
    };
  }, [refreshWorkspace, endSession, invalidate]);
  return <Context.Provider value={{ data, checking, refreshing, error, sessionEnded, refreshWorkspace, applyAccount, photo }}>{children}</Context.Provider>;
}

export function useCorporateWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error('Corporate pages require the shared workspace layout.');
  return context;
}
