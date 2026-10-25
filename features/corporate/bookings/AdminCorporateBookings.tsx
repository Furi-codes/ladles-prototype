"use client";
/**
 * Organises admin corporate requests, attendance, events and booking controls.
 * These panels share booking settings and check for unsaved changes before switching views.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { corporateBookingsEnabled, corporateChangesEnabled, corporateOutcomesEnabled } from '@/lib/config/features';
import { getCorporateBookingDetail, getCorporateBookingSettings } from '@/features/corporate/services/bookings';
import type { CorporateBookingSettings } from '@/features/corporate/types/bookings';
import { useFeatureData, FeatureState } from '@/components/ui/FeatureShared';
import CorporateBookingList from '@/features/corporate/bookings/CorporateBookingList';
import CorporateEventBrowser from '@/features/corporate/events/CorporateEventBrowser';
import CorporateBookingControls from '@/features/corporate/bookings/CorporateBookingControls';
import { CorporateChangesControls } from '@/features/corporate/bookings/CorporateCancellationControls';
import management from '@/components/ui/management.module.css';
import ui from '@/styles/corporate.module.css';

export default function CorporateBookingAdministration() {
  if (!corporateBookingsEnabled) return <p>The corporate booking rollout is not enabled on this deployment.</p>;
  return <Suspense fallback={<p role="status">Loading corporate bookings…</p>}><CorporateBookingRoute /></Suspense>;
}
function CorporateBookingRoute() {
  const params = useSearchParams(), bookingId = params.get('booking');
  const initialTab = params.get('tab') === 'attendance' && corporateOutcomesEnabled ? 'attendance' : 'bookings';
  if (params.get('tab') === 'reports') return <CorporateReportsShortcut />;
  return <CorporateBookingWorkspace key={(bookingId || 'bookings')+':'+initialTab} bookingId={bookingId} initialTab={initialTab} />;
}
/** Old report links lead to the dedicated page rather than silently opening Booking requests. */
function CorporateReportsShortcut() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/corporate-reports'); }, [router]);
  return <p role="status">Opening corporate analytics…</p>;
}
function CorporateBookingWorkspace({ bookingId, initialTab = 'bookings' }: { bookingId: string | null; initialTab?: string }) {
  const loader = useCallback(async () => {
    // The detail RPC checks access again; an inaccessible link is an error, not an empty booking.
    const [settings, linked] = await Promise.all([getCorporateBookingSettings(), bookingId ? getCorporateBookingDetail(bookingId) : null]);
    return { settings, linked };
  }, [bookingId]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const [changedSettings, setChangedSettings] = useState<CorporateBookingSettings | null>(null);
  const [tab, setTab] = useState(initialTab), [dirty, setDirty] = useState(false);
  const confirmDiscard = () => !dirty || window.confirm('Discard your unsaved corporate changes?');
  const config = changedSettings || data?.settings;
  return <div className={[management.workspace,ui.workspace].join(' ')}><nav className={ui.tabs} aria-label="Corporate booking administration">{[['bookings','Booking requests'],...(corporateOutcomesEnabled ? [['attendance','Attendance']] : []),['events','Corporate events'],['settings','Booking settings'],...(corporateChangesEnabled ? [['changes','Booking changes']] : [])].map(([key, title]) => <button key={key} aria-pressed={key === tab} onClick={() => { if (tab !== key && confirmDiscard()) { setTab(key); setDirty(false); } }}>{title}</button>)}</nav>
    <FeatureState loading={loading} error={error} retry={() => void reload()} />
    {config && !loading && !error && <>
      {tab === 'bookings' && <CorporateBookingList admin initialDetail={data?.linked || null} settings={config} dirtyChanged={setDirty} />}
      {tab === 'attendance' && corporateOutcomesEnabled && <CorporateBookingList admin attendanceOnly initialDetail={data?.linked || null} settings={config} dirtyChanged={setDirty} />}
      {tab === 'events' && <CorporateEventBrowser admin settings={config} dirtyChanged={setDirty} />}
      {tab === 'settings' && <CorporateBookingControls key={JSON.stringify(config)} initial={config} dirtyChanged={setDirty} saved={value => setChangedSettings(value)} />}
      {tab === 'changes' && corporateChangesEnabled && <CorporateChangesControls key={'changes:' + JSON.stringify(config)} initial={config} dirtyChanged={setDirty} saved={value => setChangedSettings(value)} />}
    </>}
  </div>;
}
