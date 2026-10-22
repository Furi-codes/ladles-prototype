"use client";

import { useCallback, useRef, useState } from 'react';
import { corporateChangesEnabled } from '@/lib/feature-flags';
import { CorporateCancelEventForm } from './CorporateCancellationControls';
import type { CorporateAccount } from '@/lib/corporate-account-types';
import type { CorporateEvent, CorporateEventInput, CorporateBookingSettings } from '@/lib/corporate-booking-types';
import { emptyWorkflowFilters, requestCorporateBooking, saveCorporateEvent, searchCorporateEvents } from '@/lib/actions/corporate-bookings';
import { corporateDateLabel, corporateLocalInput, corporateTimestamp } from '@/lib/corporate-booking-utils';
import { useUnsavedChanges } from '@/app/components/useUnsavedChanges';
import { FeatureState, useFeatureData } from '@/app/admin/components/FeatureShared';
import { useWorkflowClock, WorkflowFilters, WorkflowPagination } from './CorporateWorkflowShared';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';

export default function CorporateEventBrowser({ admin = false, account, settings, dirtyChanged }: { admin?: boolean; account?: CorporateAccount; settings: CorporateBookingSettings; dirtyChanged?: (dirty: boolean) => void }) {
  const [filters, setFilters] = useState(emptyWorkflowFilters);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CorporateEvent | 'new' | null>(null);
  const [requesting, setRequesting] = useState<CorporateEvent | null>(null);
  const [cancelling, setCancelling] = useState<CorporateEvent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [formEpoch, setFormEpoch] = useState(0);
  const now = useWorkflowClock();
  const loader = useCallback(() => searchCorporateEvents(filters, page), [filters, page]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const confirmDiscard = useUnsavedChanges(dirty);
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged?.(value); };
  const closeForm = () => { if (!confirmDiscard()) return; setEditing(null); setRequesting(null); setCancelling(null); reportDirty(false); };
  return <div className={management.workspace}>
    <div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Corporate events</h1><p className={styles.pageDescription}>{admin ? 'Create actual corporate opportunities, define group limits and publish available dates.' : 'Corporate-only opportunities. Dates and times are shown in South African time.'}</p></div>{admin && <button className={styles.primaryButton} onClick={() => { if (confirmDiscard()) { setEditing('new'); setRequesting(null); setCancelling(null); setFormEpoch(current => current + 1); reportDirty(false); } }}>Create corporate event</button>}</div>
    {!settings.booking_enabled && <p className={ui.notice}>New requests and acceptance are currently closed. Existing reservations and payment records remain available.</p>}
    {message && <p className={ui.notice} role="status">{message}</p>}
    {cancelling && <section className={`${styles.card} ${ui.body}`}><button className={styles.secondaryButton} onClick={closeForm}>Close cancellation form</button><CorporateCancelEventForm key={cancelling.id + ':' + formEpoch} event={cancelling} dirtyChanged={reportDirty} committed={() => { setCancelling(null); reportDirty(false); setMessage('Corporate event cancelled. Open bookings cancelled and affected companies notified in-app. Receipts/history retained.'); void reload(); }} /></section>}
    {editing && <section className={`${styles.card} ${ui.body}`}><div className={ui.actions}><h2>{editing === 'new' ? 'New corporate event' : 'Edit selected event'}</h2><button className={styles.secondaryButton} onClick={closeForm}>Close form</button></div><CorporateEventForm key={(editing === 'new' ? 'new' : editing.id + editing.version) + ':' + formEpoch} current={editing === 'new' ? undefined : editing} dirtyChanged={reportDirty} committed={() => { setEditing(null); reportDirty(false); setMessage('Corporate event saved. Affected bookings receive an in-app update.'); void reload(); }} /></section>}
    {requesting && account && <section className={`${styles.card} ${ui.body}`}><div className={ui.actions}><h2>Request a group booking</h2><button className={styles.secondaryButton} onClick={closeForm}>Close form</button></div><CorporateRequestForm key={requesting.id + ':' + formEpoch} event={requesting} account={account} dirtyChanged={reportDirty} committed={id => { setRequesting(null); reportDirty(false); setMessage('Request submitted once: ' + id + '. No places are held until admin accepts. Open My bookings for its status.'); void reload(); }} /></section>}
    <section className={styles.card}><WorkflowFilters value={filters} change={value => { setFilters(value); setPage(1); }} disabled={dirty} /><FeatureState loading={loading} error={error} retry={() => void reload()} />
      {!loading && !error && <><div className={management.tableViewport}><table className={styles.table}><thead><tr><th>Corporate event</th><th>Date / time (SA)</th><th>Capacity / available</th><th>Group limits</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data?.rows.map(event => <tr key={event.id}><td>{event.title}<small className={management.subtle}>{event.location}</small><p>{event.description}</p></td><td>{corporateDateLabel(event.starts_at)}<br />to {corporateDateLabel(event.ends_at)}</td><td>{event.capacity} / {event.remaining}</td><td>{event.min_group_size}–{event.max_group_size}</td><td><span className={ui.badge}>{event.state}</span></td><td>{admin ? <><button className={styles.secondaryButton} disabled={event.state === 'Cancelled' || Date.parse(event.starts_at) <= now} onClick={() => { if (confirmDiscard()) { setEditing(event); setRequesting(null); setCancelling(null); setFormEpoch(current => current + 1); reportDirty(false); } }}>Edit / publish</button>{corporateChangesEnabled && event.state !== 'Cancelled' && Date.parse(event.ends_at) > now && <button className={styles.dangerButton} onClick={() => { if (confirmDiscard()) { setCancelling(event); setEditing(null); setRequesting(null); setFormEpoch(current => current + 1); reportDirty(false); } }}>Cancel event</button>}</> : <button className={styles.primaryButton} disabled={!settings.booking_enabled || event.state !== 'Available'} onClick={() => { if (confirmDiscard()) { setRequesting(event); setFormEpoch(current => current + 1); reportDirty(false); } }}>Request booking</button>}</td></tr>)}{!data?.rows.length && <tr><td colSpan={6}>No matching corporate events.</td></tr>}</tbody></table></div><WorkflowPagination page={page} total={data?.total ?? 0} change={setPage} disabled={dirty} /></>}
    </section><p className={styles.helper}>Publishing is reversible before the event starts. Closing requests does not cancel bookings or release accepted places. Cancellation is irreversible and retains all payment/history records. Change-request controls are managed separately.</p>
  </div>;
}

export function CorporateEventForm({ current, committed, dirtyChanged }: { current?: CorporateEvent; committed: () => void; dirtyChanged: (dirty: boolean) => void }) {
  const [title, setTitle] = useState(current?.title || '');
  const [description, setDescription] = useState(current?.description || '');
  const [location, setLocation] = useState(current?.location || '');
  const [start, setStart] = useState(current ? corporateLocalInput(current.starts_at) : '');
  const [end, setEnd] = useState(current ? corporateLocalInput(current.ends_at) : '');
  const [capacity, setCapacity] = useState(String(current?.capacity || ''));
  const [min, setMin] = useState(String(current?.min_group_size || 1));
  const [max, setMax] = useState(String(current?.max_group_size || ''));
  const [published, setPublished] = useState(current?.is_published ?? false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ payload: string; key: string } | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return;
    const input: CorporateEventInput = { title, description, location, starts_at: '', ends_at: '', capacity: Number(capacity), min_group_size: Number(min), max_group_size: Number(max || capacity), is_published: published };
    setError('');
    try {
      input.starts_at = corporateTimestamp(start); input.ends_at = corporateTimestamp(end);
      if (!window.confirm('Save this event and notify affected bookings? Accepted reservations, payment records and group limits will be checked again.')) return;
      const payload = JSON.stringify([input, reason]);
      if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() };
      pending.current = true; setBusy(true); dirtyChanged(true);
      await saveCorporateEvent(input, reason, current ? null : intent.current.key, current);
      dirtyChanged(false); committed();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Event could not be saved.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const mark = () => dirtyChanged(true);
  return <form onSubmit={save} onChange={mark} aria-busy={busy}><fieldset className={styles.formGrid} disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>Selected corporate opportunity</legend>
    <label className={styles.field}><span className={styles.fieldLabel}>Event title</span><input className={styles.input} required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Location</span><input className={styles.input} required maxLength={300} value={location} onChange={event => setLocation(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Start (South African time)</span><input className={styles.input} required type="datetime-local" step={900} value={start} onChange={event => setStart(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>End (same SA date)</span><input className={styles.input} required type="datetime-local" step={900} value={end} onChange={event => setEnd(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Total capacity</span><input className={styles.input} required type="number" min={1} max={2147483647} step={1} value={capacity} onChange={event => setCapacity(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Minimum per booking</span><input className={styles.input} required type="number" min={1} step={1} value={min} onChange={event => setMin(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Maximum per booking</span><input className={styles.input} type="number" min={1} step={1} placeholder="Defaults to capacity" value={max} onChange={event => setMax(event.target.value)} /></label>
    <label className={management.preference}><input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} />Publish for corporate requests</label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Description</span><textarea className={styles.input} required maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Reason / message to affected bookings</span><textarea className={styles.input} required maxLength={800} value={reason} onChange={event => setReason(event.target.value)} /></label>
    {error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.primaryButton}>{busy ? 'Saving…' : 'Save corporate event'}</button>
  </fieldset></form>;
}

export function CorporateRequestForm({ event, account, committed, dirtyChanged }: { event: CorporateEvent; account: CorporateAccount; committed: (id: string) => void; dirtyChanged: (dirty: boolean) => void }) {
  const [size, setSize] = useState(String(event.min_group_size));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ payload: string; key: string } | null>(null);
  return <form onChange={() => dirtyChanged(true)} onSubmit={async submit => {
    submit.preventDefault(); if (pending.current) return;
    setError(''); const count = Number(size);
    if (!Number.isInteger(count) || count < event.min_group_size || count > event.max_group_size || count > event.remaining) { setError('Enter a whole-number group size within the current event limits and availability.'); return; }
    if (!window.confirm(`Submit ${account.company_name}'s request for ${count} people at ${event.title}, ${corporateDateLabel(event.starts_at)}? No places are reserved until admin accepts.`)) return;
    const payload = JSON.stringify([event.id, event.version, count, notes.trim()]);
    if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); dirtyChanged(true);
    try { const saved = await requestCorporateBooking(event, count, notes, intent.current.key); dirtyChanged(false); committed(saved.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Request could not be submitted. Retry with the same details to reuse its receipt key.'); }
    finally { pending.current = false; setBusy(false); }
  }}><h3>{event.title}</h3><p>{corporateDateLabel(event.starts_at)} – {corporateDateLabel(event.ends_at)} · {event.location}</p><p>Group limits: {event.min_group_size}–{event.max_group_size}. Currently {event.remaining} places available; availability is checked again on submission and acceptance.</p><p>Company: {account.company_name} · Contact: {account.contact_name}, {account.contact_email}, {account.contact_phone}<br />Billing address: {account.billing_address}</p><p>These contact and billing details are saved with this request. Future profile edits will not rewrite them.</p><fieldset disabled={busy} className={styles.formGrid} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>Group details</legend><label className={styles.field}><span className={styles.fieldLabel}>Group size</span><input className={styles.input} type="number" required min={event.min_group_size} max={Math.min(event.max_group_size, event.remaining)} step={1} value={size} onChange={change => setSize(change.target.value)} /></label><label className={styles.field}><span className={styles.fieldLabel}>Notes (optional)</span><textarea className={styles.input} maxLength={800} value={notes} onChange={change => setNotes(change.target.value)} /></label>{error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.primaryButton}>{busy ? 'Submitting…' : 'Review & submit request'}</button></fieldset><p className={ui.notice}>Request → Admin accepts and reserves places → Pending external payment → Admin confirms receipt. No payment is processed by this portal.</p></form>;
}
