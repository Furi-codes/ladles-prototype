"use client";

import { useState } from 'react';
import { corporateBookingsEnabled, corporateChangesEnabled, corporateOutcomesEnabled } from '@/lib/feature-flags';
import { getCorporateBookingDetail, getCorporateBookingSettings } from '@/lib/actions/corporate-bookings';
import type { CorporateBookingDetail, CorporateBookingSettings } from '@/lib/corporate-booking-types';
import { useFeatureData, FeatureState } from '../components/FeatureShared';
import CorporateBookingList from '@/app/corporate/components/CorporateBookingList';
import CorporateEventBrowser from '@/app/corporate/components/CorporateEventBrowser';
import CorporateBookingControls from '@/app/corporate/components/CorporateBookingControls';
import { CorporateChangesControls } from '@/app/corporate/components/CorporateCancellationControls';
import CorporateOutcomeReports from '@/app/corporate/components/CorporateOutcomeReports';
import CorporateBookingUpdates from '@/app/corporate/components/CorporateBookingUpdates';
import { BookingContact } from '@/app/corporate/components/CorporateWorkflowShared';
import styles from '../admin.module.css';
import management from '../components/management.module.css';
import ui from '@/app/corporate/corporate.module.css';

export default function CorporateBookingAdministration() {
  if (!corporateBookingsEnabled) return <p>The corporate booking rollout is not enabled on this deployment.</p>;
  return <CorporateBookingWorkspace />;
}
function CorporateBookingWorkspace() {
  const { data, loading, error, reload } = useFeatureData(getCorporateBookingSettings);
  const [changedSettings, setChangedSettings] = useState<CorporateBookingSettings | null>(null);
  const [tab, setTab] = useState('bookings'), [dirty, setDirty] = useState(false), [opening, setOpening] = useState(false), [noticeError, setNoticeError] = useState('');
  const [selected, setSelected] = useState<CorporateBookingDetail | null>(null), [selectionKey, setSelectionKey] = useState(0);
  const confirmDiscard = () => !dirty || window.confirm('Discard your unsaved corporate changes?');
  const config = changedSettings || data;
  return <div className={management.workspace}><nav className={ui.tabs} aria-label="Corporate booking administration">{[['bookings','Booking requests'],['events','Corporate events'],['updates','Booking updates'],['settings','Booking settings'],...(corporateChangesEnabled ? [['changes','Booking changes']] : []),...(corporateOutcomesEnabled ? [['reports','Corporate reports']] : [])].map(([key, title]) => <button key={key} disabled={opening} aria-pressed={key === tab} onClick={() => { if (tab !== key && confirmDiscard()) { setTab(key); setDirty(false); setNoticeError(''); } }}>{title}</button>)}</nav>
    <FeatureState loading={loading} error={error} retry={() => void reload()} />{noticeError && <p className={styles.error} role="alert">{noticeError}</p>}
    {config && !loading && !error && <>
      {tab === 'bookings' && <CorporateBookingList key={selectionKey} admin initialDetail={selected} settings={config} dirtyChanged={setDirty} />}
      {tab === 'events' && <CorporateEventBrowser admin settings={config} dirtyChanged={setDirty} />}
      {tab === 'updates' && <CorporateBookingUpdates goToBooking={async id => {
        if (!confirmDiscard()) throw new Error('Booking navigation cancelled.'); setOpening(true); setNoticeError('');
        try { const linked = await getCorporateBookingDetail(id); setSelected(linked); setSelectionKey(current => current + 1); setDirty(false); setTab('bookings'); }
        finally { setOpening(false); }
      }} />}
      {tab === 'settings' && <CorporateBookingControls key={JSON.stringify(config)} initial={config} dirtyChanged={setDirty} saved={value => setChangedSettings(value)} />}
      {tab === 'changes' && corporateChangesEnabled && <CorporateChangesControls key={'changes:' + JSON.stringify(config)} initial={config} dirtyChanged={setDirty} saved={value => setChangedSettings(value)} />}
      {tab === 'reports' && corporateOutcomesEnabled && <CorporateOutcomeReports admin />}
      <BookingContact settings={config} />
    </>}
  </div>;
}
