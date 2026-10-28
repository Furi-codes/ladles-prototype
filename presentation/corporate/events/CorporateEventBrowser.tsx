"use client";

/**
 * Lets companies browse sessions and lets admin create or edit them.
 * Requesting a session and saving an event use different forms; requesting alone does not
 * reserve it.
 */

import { userFacingError } from '@/business/shared/errors/user-facing';

import { useCallback, useEffect, useRef, useState } from 'react';
import { corporateChangesEnabled } from '@/business/shared/config/features';
import { CorporateCancelEventForm } from '@/presentation/corporate/bookings/CorporateCancellationControls';
import type { CorporateAccount } from '@/business/corporate/types/accounts';
import type { CorporateEvent, CorporateEventInput, CorporateBookingSettings } from '@/business/corporate/types/bookings';
import { emptyWorkflowFilters, requestCorporateBooking, saveCorporateEvent, searchCorporateEvents } from '@/business/corporate/services/bookings';
import { corporateDateLabel, corporateLocalInput, corporateTimestamp } from '@/business/corporate/utils/bookings';
import { canRequestCorporateSession } from '@/business/corporate/utils/calendar';
import { useUnsavedChanges } from '@/presentation/hooks/useUnsavedChanges';
import { FeatureState } from '@/presentation/components/ui/FeatureShared';
import { useCorporateFeatureData as useFeatureData } from '@/presentation/corporate/hooks/useCorporateFeatureData';
import { useWorkflowClock, WorkflowFilters, WorkflowPagination } from '@/presentation/corporate/shared/CorporateWorkflowShared';
import CorporateCalendar from '@/presentation/corporate/calendar/CorporateCalendar';
import styles from '@/presentation/styles/admin.module.css';
import management from '@/presentation/components/ui/management.module.css';
import ui from '@/presentation/styles/corporate.module.css';

export default function CorporateEventBrowser({ admin = false, account, settings, dirtyChanged }: { admin?: boolean; account?: CorporateAccount; settings: CorporateBookingSettings; dirtyChanged?: (dirty: boolean) => void }) {
  const [filters, setFilters] = useState(emptyWorkflowFilters);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [creationDate, setCreationDate] = useState('');
  const [editing, setEditing] = useState<CorporateEvent | 'new' | null>(null);
  const [requesting, setRequesting] = useState<CorporateEvent | null>(null);
  const [cancelling, setCancelling] = useState<CorporateEvent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [formEpoch, setFormEpoch] = useState(0);
  const formPanel = useRef<HTMLElement>(null);
  // Forms open above the results, so selecting a row must also reveal its form.
  useEffect(() => { if (editing || requesting || cancelling) { formPanel.current?.focus({ preventScroll: true }); formPanel.current?.scrollIntoView({ block: 'start' }); } }, [editing, requesting, cancelling, formEpoch]);
  const now = useWorkflowClock();
  const loader = useCallback(() => view === 'list' ? searchCorporateEvents(filters, page) : Promise.resolve({ rows: [], total: 0 }), [filters, page, view]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const confirmDiscard = useUnsavedChanges(dirty);
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged?.(value); };
  const closeForm = () => { if (!confirmDiscard()) return; setEditing(null); setRequesting(null); setCancelling(null); reportDirty(false); };
  const refreshResults = () => { setCalendarRevision(current => current + 1); void reload(); };
  const createEvent = (date = '') => { if (confirmDiscard()) { setCreationDate(date); setEditing('new'); setRequesting(null); setCancelling(null); setFormEpoch(current => current + 1); reportDirty(false); } };
  const chooseEvent = (event: CorporateEvent) => { if (confirmDiscard()) { if (admin) setEditing(event); else setRequesting(event); setCancelling(null); setFormEpoch(current => current + 1); reportDirty(false); } };
  const cancelSelectedEvent = (event: CorporateEvent) => { if (confirmDiscard()) { setCancelling(event); setEditing(null); setRequesting(null); setFormEpoch(current => current + 1); reportDirty(false); } };
  return <div className={[management.workspace,ui.workspace].join(' ')}>
    <div className={`${styles.pageHeading} ${management.workspaceHeading}`}><div><h1 className={styles.pageTitle}>{admin ? 'Corporate events' : 'Browse events'}</h1><p className={styles.pageDescription}>{admin ? 'Create exclusive corporate sessions, set a maximum group size and open available dates.' : 'Choose an exclusive session for your company. Dates and times are shown in South African time.'}</p></div>{admin && <button className={styles.primaryButton} onClick={() => createEvent()}>Create corporate event</button>}</div>
    {!settings.booking_enabled && <p className={ui.notice}>{admin ? 'New requests and acceptance are closed. Manage availability in Booking settings.' : 'New booking requests are currently closed. You can still view your existing bookings under My bookings.'}</p>}
    {message && <p className={ui.notice} role="status">{message}</p>}
    {cancelling && <section ref={formPanel} tabIndex={-1} aria-label="Event form" className={`${styles.card} ${ui.body} ${ui.focusTarget}`}><button className={styles.secondaryButton} onClick={closeForm}>Close cancellation form</button><CorporateCancelEventForm key={cancelling.id + ':' + formEpoch} event={cancelling} dirtyChanged={reportDirty} committed={() => { setCancelling(null); reportDirty(false); setMessage('Corporate event cancelled. Open bookings cancelled and affected companies notified in-app. Receipts/history retained.'); refreshResults(); }} /></section>}
    {editing && <section ref={formPanel} tabIndex={-1} aria-label="Event form" className={`${styles.card} ${ui.body} ${ui.focusTarget}`}><div className={ui.actions}><h2>{editing === 'new' ? 'New corporate event' : 'Edit selected event'}</h2><button className={styles.secondaryButton} onClick={closeForm}>Close form</button></div><CorporateEventForm key={(editing === 'new' ? 'new' : editing.id + editing.version) + ':' + formEpoch} initialDate={creationDate} current={editing === 'new' ? undefined : editing} dirtyChanged={reportDirty} committed={() => { setEditing(null); reportDirty(false); setMessage('Corporate event saved. Affected bookings receive an in-app update.'); refreshResults(); }} /></section>}
    {requesting && account && <section ref={formPanel} tabIndex={-1} aria-label="Event form" className={`${styles.card} ${ui.body} ${ui.focusTarget}`}><div className={ui.actions}><h2>Request a group booking</h2><button className={styles.secondaryButton} onClick={closeForm}>Close form</button></div><CorporateRequestForm key={requesting.id + ':' + formEpoch} event={requesting} account={account} dirtyChanged={reportDirty} committed={() => { setRequesting(null); reportDirty(false); setMessage('Request submitted. Track its status under My bookings. The whole session is reserved only when admin accepts your request.'); refreshResults(); }} /></section>}
    <section className={styles.card}><WorkflowFilters value={filters} change={value => { setFilters(value); setPage(1); }} disabled={dirty} /><div className={ui.viewToggle} aria-label="Event view"><button type="button" className={view === 'calendar' ? styles.primaryButton : styles.secondaryButton} aria-pressed={view === 'calendar'} disabled={dirty} onClick={() => setView('calendar')}>Calendar</button><button type="button" className={view === 'list' ? styles.primaryButton : styles.secondaryButton} aria-pressed={view === 'list'} disabled={dirty} onClick={() => setView('list')}>List</button></div>{view === 'calendar' ? <CorporateCalendar key={filters.from + ':' + filters.to} mode="events" filters={filters} admin={admin} now={now} disabled={dirty} requestsOpen={settings.booking_enabled} revision={calendarRevision} onEvent={chooseEvent} onCancelEvent={cancelSelectedEvent} onCreateDate={admin ? createEvent : undefined} /> : <><FeatureState loading={loading} error={error} retry={() => void reload()} />
      {!loading && !error && <><div className={`${management.tableViewport} ${ui.responsiveTable}`}><table role="table" aria-label="Corporate sessions" className={styles.table}><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Corporate event</th><th role="columnheader" scope="col">Date / time (SA)</th><th role="columnheader" scope="col">Maximum group size</th><th role="columnheader" scope="col">Session</th><th role="columnheader" scope="col">Status</th><th role="columnheader" scope="col">Actions</th></tr></thead><tbody role="rowgroup">{data?.rows.map(event => <tr role="row" key={event.id}><td role="cell" data-label="Corporate event">{event.title}<small className={management.subtle}>{event.location}</small><p>{event.description}</p></td><td role="cell" data-label="Date / time (SA)">{corporateDateLabel(event.starts_at)}<br />to {corporateDateLabel(event.ends_at)}</td><td role="cell" data-label="Maximum group size">{event.max_group_size} people</td><td role="cell" data-label="Session">Exclusive · one company</td><td role="cell" data-label="Status"><span className={ui.badge}>{event.state}</span></td><td role="cell" data-label="Actions">{admin ? <><button className={styles.secondaryButton} disabled={event.state === 'Cancelled' || Date.parse(event.starts_at) <= now} onClick={() => { if (confirmDiscard()) { setEditing(event); setRequesting(null); setCancelling(null); setFormEpoch(current => current + 1); reportDirty(false); } }}>Edit session</button>{corporateChangesEnabled && event.state !== 'Cancelled' && Date.parse(event.ends_at) > now && <button className={styles.dangerButton} onClick={() => { if (confirmDiscard()) { setCancelling(event); setEditing(null); setRequesting(null); setFormEpoch(current => current + 1); reportDirty(false); } }}>Cancel event</button>}</> : <button className={styles.primaryButton} disabled={!settings.booking_enabled || !canRequestCorporateSession(event, now)} onClick={() => { if (confirmDiscard()) { setRequesting(event); setFormEpoch(current => current + 1); reportDirty(false); } }}>Request booking</button>}</td></tr>)}{!data?.rows.length && <tr role="row"><td role="cell" colSpan={6}>No matching corporate events.</td></tr>}</tbody></table></div><WorkflowPagination page={page} total={data?.total ?? 0} change={setPage} disabled={dirty} /></>}
    </>}</section><p className={styles.helper}>{admin ? 'Publishing is reversible before the event starts. Closing requests does not cancel bookings or release the reserved session. Cancellation is irreversible and retains all payment/history records. Change-request controls are managed separately.' : 'Submitting a request does not reserve the session. Admin acceptance reserves the entire session for your company. Other pending requests for it are then declined. Track the decision and any payment deadline under My bookings.'}</p>
  </div>;
}

/**
 * Edit one corporate session with a maximum group size. Draft/publication and affected-company
 * messages travel with the versioned save.
 */
export function CorporateEventForm({ current, initialDate = '', committed, dirtyChanged }: { current?: CorporateEvent; initialDate?: string; committed: () => void; dirtyChanged: (dirty: boolean) => void }) {
  const [title, setTitle] = useState(current?.title || '');
  const [description, setDescription] = useState(current?.description || '');
  const [location, setLocation] = useState(current?.location || '');
  const [start, setStart] = useState(current ? corporateLocalInput(current.starts_at) : initialDate ? initialDate + 'T09:00' : '');
  const [end, setEnd] = useState(current ? corporateLocalInput(current.ends_at) : initialDate ? initialDate + 'T10:00' : '');
  const [max, setMax] = useState(String(current?.max_group_size || ''));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ payload: string; key: string } | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return;
    const submitter = (event.nativeEvent as SubmitEvent | undefined)?.submitter as HTMLButtonElement | null | undefined;
    const published = submitter ? submitter.value === 'publish' : current?.is_published ?? false;
    // One session belongs to one company; the three transport fields share one maximum.
    const input: CorporateEventInput = { title, description, location, starts_at: '', ends_at: '', capacity: Number(max), min_group_size: 1, max_group_size: Number(max), is_published: published };
    setError('');
    try {
      input.starts_at = corporateTimestamp(start); input.ends_at = corporateTimestamp(end);
      if (!window.confirm(`${published ? 'Publish this exclusive session for requests' : 'Save this session as a draft (closed to new requests)'}? Existing accepted reservations stay held. Affected companies will receive your change message.`)) return;
      const payload = JSON.stringify([input, reason]);
      if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() };
      pending.current = true; setBusy(true); dirtyChanged(true);
      await saveCorporateEvent(input, current ? reason : 'Corporate session created.', current ? null : intent.current.key, current);
      dirtyChanged(false); committed();
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Event could not be saved.', "Event could not be saved.")); }
    finally { pending.current = false; setBusy(false); }
  }
  const mark = () => dirtyChanged(true);
  return <form onSubmit={save} onChange={mark} aria-busy={busy}><fieldset className={styles.formGrid} disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>Selected corporate opportunity</legend>
    <label className={styles.field}><span className={styles.fieldLabel}>Event title</span><input className={styles.input} required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Location</span><input className={styles.input} required maxLength={300} value={location} onChange={event => setLocation(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Start (South African time)</span><input className={styles.input} required type="datetime-local" step={900} value={start} onChange={event => setStart(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>End (same SA date)</span><input className={styles.input} required type="datetime-local" step={900} value={end} onChange={event => setEnd(event.target.value)} /></label>
    <label className={styles.field}><span className={styles.fieldLabel}>Maximum group size</span><input className={styles.input} required type="number" min={1} max={2147483647} step={1} value={max} onChange={event => setMax(event.target.value)} /></label>
    <p className={styles.fieldFull}>One company per session, regardless of group size. Save draft keeps or closes the session to new requests; Publish event makes it visible for requests. Neither action cancels an accepted reservation.</p>
    {current && <p className={styles.fieldFull}>Current visibility: {current.is_published ? 'Published for requests' : 'Draft — closed to new requests'}. {current.reserved_places>0 ? 'This session is exclusively reserved.' : ''}</p>}
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Description</span><textarea className={styles.input} required maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
    {current && <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Change message {current.affected_bookings === 0 ? '(optional — no open bookings)' : '(required for affected companies)'}</span><textarea className={styles.input} required={current.affected_bookings !== 0} maxLength={800} value={reason} onChange={event => setReason(event.target.value)} /></label>}
    {error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<div className={`${ui.formFooter} ${styles.fieldFull}`}><button type="submit" name="publication" value="draft" className={styles.secondaryButton}>{busy ? 'Saving…' : 'Save draft'}</button><button type="submit" name="publication" value="publish" className={styles.primaryButton}>{busy ? 'Saving…' : 'Publish event'}</button></div>
  </fieldset></form>;
}

/**
 * Validate the group request and keep its retry identity. The session stays unreserved until
 * admin accepts it.
 */
export function CorporateRequestForm({ event, account, committed, dirtyChanged }: { event: CorporateEvent; account: CorporateAccount; committed: (id: string) => void; dirtyChanged: (dirty: boolean) => void }) {
  const [size, setSize] = useState(String(event.min_group_size));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ payload: string; key: string } | null>(null);
  return <form onChange={() => dirtyChanged(true)} onSubmit={async submit => {
    submit.preventDefault(); if (pending.current) return;
    setError(''); const count = Number(size);
    if (!canRequestCorporateSession(event)) { setError('This session is past, reserved, unpublished or cancelled. Refresh and choose an available future session.'); return; }
    if (!Number.isInteger(count) || count < event.min_group_size || count > event.max_group_size || count > event.remaining) { setError('Enter a whole-number group size within the current event limits and availability.'); return; }
    if (!window.confirm(`Submit ${account.company_name}'s request for ${count} people at ${event.title}, ${corporateDateLabel(event.starts_at)}? The session is not reserved until admin accepts. Other requests can be submitted before acceptance.`)) return;
    const payload = JSON.stringify([event.id, event.version, count, notes.trim()]);
    if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); dirtyChanged(true);
    try { const saved = await requestCorporateBooking(event, count, notes, intent.current.key); dirtyChanged(false); committed(saved.id); }
    catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Request could not be confirmed. You can retry with the same details without creating a duplicate.', "Request could not be confirmed. You can retry with the same details without creating a duplicate.")); }
    finally { pending.current = false; setBusy(false); }
  }}><h3>{event.title}</h3><p>{corporateDateLabel(event.starts_at)} – {corporateDateLabel(event.ends_at)} · {event.location}</p><p>Exclusive session for one company · maximum {event.max_group_size} people. A request does not reserve it. Availability is checked again on submission and admin acceptance; competing requests are declined when one is accepted.</p><p>Company: {account.company_name} · Contact: {account.contact_name}, {account.contact_email}, {account.contact_phone}<br />Billing address: {account.billing_address}</p><p>These contact and billing details are saved with this request. Future profile edits will not rewrite them.</p><fieldset disabled={busy} className={styles.formGrid} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>Group details</legend><label className={styles.field}><span className={styles.fieldLabel}>Group size</span><input className={styles.input} type="number" required min={event.min_group_size} max={Math.min(event.max_group_size, event.remaining)} step={1} value={size} onChange={change => setSize(change.target.value)} /></label><label className={styles.field}><span className={styles.fieldLabel}>Notes (optional)</span><textarea className={styles.input} maxLength={800} value={notes} onChange={change => setNotes(change.target.value)} /></label>{error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<div className={ui.formFooter}><button type="submit" className={styles.primaryButton}>{busy ? 'Submitting…' : 'Review & submit request'}</button></div></fieldset><p className={ui.notice}>Request (no reservation) → Admin accepts and reserves the whole session → Pending external payment → Admin confirms receipt. No payment is processed by this portal.</p></form>;
}
