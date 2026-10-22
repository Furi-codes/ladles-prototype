"use client";

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { corporateBookingsEnabled } from '@/lib/feature-flags';
import { getMyCorporateAccount } from '@/lib/actions/corporate-accounts';
import { getCorporateBookingDetail, getCorporateBookingSettings } from '@/lib/actions/corporate-bookings';
import type { CorporateAccount } from '@/lib/corporate-account-types';
import type { CorporateBookingDetail, CorporateBookingSettings } from '@/lib/corporate-booking-types';
import CorporateFrame from './CorporateFrame';
import CorporateBookingList from './CorporateBookingList';
import CorporateEventBrowser from './CorporateEventBrowser';
import CorporateOutcomeReports from './CorporateOutcomeReports';
import CorporateBookingUpdates from './CorporateBookingUpdates';
import { BookingContact } from './CorporateWorkflowShared';
import styles from '@/app/admin/admin.module.css';

/** No volunteer provider or legacy CSR loader is used anywhere in this workspace. */
export default function CorporateWorkflowPortal({ mode }: { mode: 'bookings' | 'events' | 'updates' | 'reports' }) {
  if (!corporateBookingsEnabled) return <CorporateFrame><h1>Corporate booking access is not enabled yet</h1><Link href="/corporate">Open business profile</Link></CorporateFrame>;
  return <Suspense fallback={<p role="status">Loading corporate workspace…</p>}><CorporateRoute mode={mode} /></Suspense>;
}
function CorporateRoute({ mode }: { mode: 'bookings' | 'events' | 'updates' | 'reports' }) {
  const search = useSearchParams();
  const bookingId = mode === 'bookings' ? search.get('booking') : null;
  // Query-only navigation must replace the previous record and any forms tied to it.
  return <CorporateWorkspace key={mode + ':' + (bookingId || '')} mode={mode} linkedBookingId={bookingId} />;
}
function CorporateWorkspace({ mode, linkedBookingId }: { mode: 'bookings' | 'events' | 'updates' | 'reports'; linkedBookingId: string | null }) {
  const router = useRouter();
  const [account, setAccount] = useState<CorporateAccount | null>(null);
  const [settings, setSettings] = useState<CorporateBookingSettings | null>(null);
  const [initialDetail, setInitialDetail] = useState<CorporateBookingDetail | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
        if (!data.user) { router.replace('/?portal=corporate'); return; }
        const company = await getMyCorporateAccount();
        if (!company) { router.replace('/corporate/register'); return; }
        if (company.status !== 'Approved' || !data.user.email_confirmed_at) { router.replace('/corporate'); return; }
        const config = await getCorporateBookingSettings();
        if (config.booking_schema_version !== 1) throw new Error('Corporate bookings are temporarily unavailable. Please contact the booking team.');
        const linked = linkedBookingId ? await getCorporateBookingDetail(linkedBookingId) : null;
        if (active) { setAccount(company); setSettings(config); setInitialDetail(linked); setError(''); }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Corporate workspace could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [linkedBookingId, router, retry]);
  return <CorporateFrame signedIn workflowAccess={Boolean(account)}>{loading && <p role="status">Loading corporate workspace…</p>}{error && <p className={styles.error} role="alert">{error}<button className={styles.secondaryButton} onClick={() => { setLoading(true); setRetry(retry + 1); }}>Retry</button></p>}
    {!loading && !error && account && settings && <>
      {mode === 'bookings' && <CorporateBookingList initialDetail={initialDetail} settings={settings} />}
      {mode === 'events' && <CorporateEventBrowser account={account} settings={settings} />}
      {mode === 'updates' && <CorporateBookingUpdates goToBooking={async id => { await getCorporateBookingDetail(id); router.push('/corporate/bookings?booking=' + encodeURIComponent(id)); }} />}
      {mode === 'reports' && <CorporateOutcomeReports />}
      <BookingContact settings={settings} />
    </>}
  </CorporateFrame>;
}
