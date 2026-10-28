"use client";

/**
 * Opens the requested corporate feature after checking workspace readiness.
 * Account approval, verification and booking settings are checked before showing controls for
 * new requests.
 */

import { Suspense, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { corporateBookingsEnabled } from '@/business/shared/config/features';
import { getCorporateBookingDetail } from '@/business/corporate/services/bookings';
import { FeatureState, useFeatureData } from '@/presentation/components/ui/FeatureShared';
import { useCorporateWorkspace } from '@/presentation/corporate/shell/CorporateWorkspaceProvider';
import CorporateContentLoading from '@/presentation/corporate/shell/CorporateContentLoading';
import CorporateBookingList from '@/presentation/corporate/bookings/CorporateBookingList';
import CorporateEventBrowser from '@/presentation/corporate/events/CorporateEventBrowser';
import CorporateOutcomeReports from '@/presentation/corporate/reports/CorporateOutcomeReports';
import CorporateBookingUpdates from '@/presentation/corporate/notifications/CorporateBookingUpdates';
import styles from '@/presentation/styles/admin.module.css';

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
