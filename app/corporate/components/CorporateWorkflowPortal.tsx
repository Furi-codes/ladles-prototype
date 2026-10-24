"use client";

import { Suspense, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { corporateBookingsEnabled } from '@/lib/feature-flags';
import { getCorporateBookingDetail } from '@/lib/actions/corporate-bookings';
import { FeatureState, useFeatureData } from '@/app/admin/components/FeatureShared';
import { useCorporateWorkspace } from './CorporateWorkspaceProvider';
import CorporateContentLoading from './CorporateContentLoading';
import CorporateBookingList from './CorporateBookingList';
import CorporateEventBrowser from './CorporateEventBrowser';
import CorporateOutcomeReports from './CorporateOutcomeReports';
import CorporateBookingUpdates from './CorporateBookingUpdates';
import styles from '@/app/admin/admin.module.css';

type Mode = 'bookings' | 'events' | 'updates' | 'reports';

/** The layout owns the frame and access checks; pages only load their own feature data. */
export default function CorporateWorkflowPortal({ mode }: { mode: Mode }) {
  if (!corporateBookingsEnabled) return <><h1>Corporate booking access is not enabled yet</h1><Link href="/corporate">Open business profile</Link></>;
  return <Suspense fallback={<CorporateContentLoading />}><CorporateRoute mode={mode} /></Suspense>;
}
function CorporateRoute({ mode }: { mode: Mode }) {
  const search = useSearchParams();
  const bookingId = mode === 'bookings' ? search.get('booking') : null;
  // A query-only navigation replaces the selected booking without remounting the shared header.
  return <CorporateWorkspace key={mode + ':' + (bookingId || '')} mode={mode} linkedBookingId={bookingId} />;
}
function CorporateWorkspace({ mode, linkedBookingId }: { mode: Mode; linkedBookingId: string | null }) {
  const router = useRouter();
  const { data, refreshWorkspace, refreshing } = useCorporateWorkspace();
  const access = Boolean(data?.account.status === 'Approved' && data.emailVerified);
  useEffect(() => { if (data && !access) router.replace('/corporate'); }, [data, access, router]);
  const loader = useCallback(() => access && linkedBookingId ? getCorporateBookingDetail(linkedBookingId) : Promise.resolve(null), [access, linkedBookingId]);
  const { data: initialDetail, loading, error, reload } = useFeatureData(loader);
  if (!data || !access) return <CorporateContentLoading message="Opening your business profile…" />;
  if (data.settingsError || !data.settings) return <div className={styles.error} role="alert">{data.settingsError || 'Corporate booking settings are unavailable.'}<button className={styles.secondaryButton} disabled={refreshing} onClick={() => void refreshWorkspace(true)}>Retry</button></div>;
  if (linkedBookingId && (loading || error)) return <FeatureState loading={loading} error={error} retry={() => void reload()} />;
  const { account, settings } = data;
  return <>
    {mode === 'bookings' && <CorporateBookingList initialDetail={initialDetail} settings={settings} />}
    {mode === 'events' && <CorporateEventBrowser account={account} settings={settings} />}
    {mode === 'updates' && <CorporateBookingUpdates goToBooking={async id => { await getCorporateBookingDetail(id); router.push('/corporate/bookings?booking=' + encodeURIComponent(id)); }} />}
    {mode === 'reports' && <CorporateOutcomeReports />}
  </>;
}
