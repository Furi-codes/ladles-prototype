"use client";

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { corporateBookingsEnabled, corporateChangesEnabled, corporateOutcomesEnabled } from '@/lib/feature-flags';
import { getCorporateBookingDetail, getCorporateBookingSettings } from '@/lib/actions/corporate-bookings';
import type { CorporateBookingSettings } from '@/lib/corporate-booking-types';
import { useFeatureData, FeatureState } from '../components/FeatureShared';
import CorporateBookingList from '@/app/corporate/components/CorporateBookingList';
import CorporateEventBrowser from '@/app/corporate/components/CorporateEventBrowser';
import CorporateBookingControls from '@/app/corporate/components/CorporateBookingControls';
import { CorporateChangesControls } from '@/app/corporate/components/CorporateCancellationControls';
import CorporateOutcomeReports from '@/app/corporate/components/CorporateOutcomeReports';
import management from '../components/management.module.css';
import ui from '@/app/corporate/corporate.module.css';

export default function CorporateBookingAdministration() {
  if (!corporateBookingsEnabled) return <p>The corporate booking rollout is not enabled on this deployment.</p>;
  return <Suspense fallback={<p role="status">Loading corporate bookings…</p>}><CorporateBookingRoute /></Suspense>;
}
function CorporateBookingRoute() {
  const bookingId = useSearchParams().get('booking');
  return <CorporateBookingWorkspace key={bookingId || 'bookings'} bookingId={bookingId} />;
}
function CorporateBookingWorkspace({ bookingId }: { bookingId: string | null }) {
  const loader = useCallback(async () => {
    // The detail RPC checks access again; an inaccessible link is an error, not an empty booking.
    const [settings, linked] = await Promise.all([getCorporateBookingSettings(), bookingId ? getCorporateBookingDetail(bookingId) : null]);
    return { settings, linked };
  }, [bookingId]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const [changedSettings, setChangedSettings] = useState<CorporateBookingSettings | null>(null);
  const [tab, setTab] = useState('bookings'), [dirty, setDirty] = useState(false);
  const confirmDiscard = () => !dirty || window.confirm('Discard your unsaved corporate changes?');
  const config = changedSettings || data?.settings;
  return <div className={[management.workspace,ui.workspace].join(' ')}><nav className={ui.tabs} aria-label="Corporate booking administration">{[['bookings','Booking requests'],['events','Corporate events'],['settings','Booking settings'],...(corporateChangesEnabled ? [['changes','Booking changes']] : []),...(corporateOutcomesEnabled ? [['reports','Corporate reports']] : [])].map(([key, title]) => <button key={key} aria-pressed={key === tab} onClick={() => { if (tab !== key && confirmDiscard()) { setTab(key); setDirty(false); } }}>{title}</button>)}</nav>
    <FeatureState loading={loading} error={error} retry={() => void reload()} />
    {config && !loading && !error && <>
      {tab === 'bookings' && <CorporateBookingList admin initialDetail={data?.linked || null} settings={config} dirtyChanged={setDirty} />}
      {tab === 'events' && <CorporateEventBrowser admin settings={config} dirtyChanged={setDirty} />}
      {tab === 'settings' && <CorporateBookingControls key={JSON.stringify(config)} initial={config} dirtyChanged={setDirty} saved={value => setChangedSettings(value)} />}
      {tab === 'changes' && corporateChangesEnabled && <CorporateChangesControls key={'changes:' + JSON.stringify(config)} initial={config} dirtyChanged={setDirty} saved={value => setChangedSettings(value)} />}
      {tab === 'reports' && corporateOutcomesEnabled && <CorporateOutcomeReports admin />}
    </>}
  </div>;
}
