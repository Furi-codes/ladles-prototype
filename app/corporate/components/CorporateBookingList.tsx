"use client";

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import type { CorporateBookingDetail, CorporateBookingSettings } from '@/lib/corporate-booking-types';
import { emptyWorkflowFilters, getCorporateBookingDetail, recordCorporatePayment, rejectCorporateBooking, searchCorporateBookings, setCorporatePaymentDeadline } from '@/lib/actions/corporate-bookings';
import { corporateBookingOverdue, corporateDateLabel, corporateLocalInput, corporateTimestamp } from '@/lib/corporate-booking-utils';
import { useUnsavedChanges } from '@/app/components/useUnsavedChanges';
import { FeatureState, useFeatureData } from '@/app/admin/components/FeatureShared';
import { useWorkflowClock, WorkflowFilters, WorkflowHistory, WorkflowPagination } from './CorporateWorkflowShared';
import CorporateChangeActions from './CorporateChangeActions';
import CorporateAttendance from './CorporateAttendance';
import { corporateOutcomesEnabled } from '@/lib/feature-flags';
import { canRecordCorporateAttendance } from '@/lib/corporate-outcomes';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';

export default function CorporateBookingList({ admin = false, initialDetail = null, settings, dirtyChanged }: { admin?: boolean; initialDetail?: CorporateBookingDetail | null; settings: CorporateBookingSettings; dirtyChanged?: (dirty: boolean) => void }) {
  const [filters, setFilters] = useState(emptyWorkflowFilters);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(initialDetail);
  const [dirty, setDirty] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [detailEpoch, setDetailEpoch] = useState(0);
  const now = useWorkflowClock();
  const confirmDiscard = useUnsavedChanges(dirty);
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged?.(value); };
  const loader = useCallback(() => searchCorporateBookings(filters, page), [filters, page]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  async function open(id: string) {
    if (opening || !confirmDiscard()) return;
    setOpening(true); setError('');
    try { setDetail(await getCorporateBookingDetail(id)); setDetailEpoch(current => current + 1); reportDirty(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Booking could not be opened.'); }
    finally { setOpening(false); }
  }
  return <div className={management.workspace}><div><h1 className={styles.pageTitle}>{admin ? 'Corporate booking requests' : 'My corporate bookings'}</h1><p className={styles.pageDescription}>Requests, held places, external-payment deadlines and confirmed group bookings.</p></div>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={ui.notice} role="status">{message}</p>}
    <section className={styles.card}><WorkflowFilters value={filters} statuses disabled={dirty || opening} change={value => { setFilters(value); setPage(1); }} /><FeatureState loading={loading} error={loadError} retry={() => void reload()} />
    {!loading && !loadError && <><div className={management.tableViewport}><table className={styles.table}><thead><tr><th>Company / booking</th><th>Event (SA time)</th><th>Group</th><th>Status</th><th>Payment deadline</th><th>Actions</th></tr></thead><tbody>{data?.rows.map(booking => <tr key={booking.id}><td>{booking.contact_snapshot.company_name}<small className={management.subtle}>{booking.contact_snapshot.contact_name}<br />{booking.id}</small></td><td>{booking.event.title}<small className={management.subtle}>{corporateDateLabel(booking.event.starts_at)}<br />{booking.event.location}</small></td><td>{booking.group_size}</td><td><span className={ui.badge}>{booking.status}</span>{booking.pending_change && <p>{booking.pending_change.kind} requested</p>}{corporateBookingOverdue(booking, now) && <p>Overdue · places remain held</p>}</td><td>{booking.status.startsWith('Pending') && booking.payment_due_at ? corporateDateLabel(booking.payment_due_at) : '—'}</td><td><button className={styles.secondaryButton} disabled={opening} onClick={() => void open(booking.id)}>{admin ? 'Review booking' : 'Details'}</button></td></tr>)}{!data?.rows.length && <tr><td colSpan={6}>No matching bookings.</td></tr>}</tbody></table></div><WorkflowPagination page={page} total={data?.total ?? 0} change={setPage} disabled={dirty || opening} /></>}
    </section>
    {detail && <CorporateBookingPanel key={detail.booking.id + ':' + detail.booking.version + ':' + detailEpoch} detail={detail} admin={admin} settings={settings} dirtyChanged={reportDirty} refresh={() => void open(detail.booking.id)} committed={async saved => {
      // The decision is committed. Keep that response visible even if reloading the receipt/history fails.
      setDetail(current => current ? { ...current, booking: { ...current.booking, ...saved } } : null); reportDirty(false); setMessage('Booking update saved. Open Booking updates for the related in-app notifications.');
      try { setDetail(await getCorporateBookingDetail(saved.id)); } catch { setMessage('Decision saved, but receipt/history refresh failed. Refresh this booking to load its latest details.'); }
      void reload();
    }} />}
  </div>;
}

type PanelProps = { detail: CorporateBookingDetail; admin: boolean; settings: CorporateBookingSettings; dirtyChanged: (dirty: boolean) => void; refresh: () => void; committed: (booking: CorporateBookingDetail['booking'] | Awaited<ReturnType<typeof rejectCorporateBooking>>) => Promise<void> };
export function CorporateBookingPanel({ detail, admin, settings, dirtyChanged, refresh, committed }: PanelProps) {
  const [mode, setMode] = useState<'' | 'deadline' | 'payment' | 'reject'>('');
  const [formDirty, setFormDirty] = useState(false);
  const [workflowSection, setWorkflowSection] = useState(() => corporateOutcomesEnabled && (detail.booking.attendance || canRecordCorporateAttendance(detail.booking)) ? 'attendance' : 'changes');
  const now = useWorkflowClock(), b = detail.booking, c = b.contact_snapshot;
  const reportDirty = (value: boolean) => { setFormDirty(value); dirtyChanged(value); };
  const changeMode = (value: typeof mode) => { if (formDirty && !window.confirm('Discard your unsaved booking decision?')) return; setMode(value); reportDirty(false); };
  const pending = b.status.startsWith('Pending'), started = Date.parse(b.event.starts_at) <= now;
  return <section className={`${styles.card} ${ui.body}`}><div className={ui.actions}><h2>Booking details</h2><button className={styles.secondaryButton} onClick={refresh}>Refresh record</button></div><p>{b.id}</p><span className={ui.badge}>{b.status}</span><h3>{b.event.title}</h3><p>{corporateDateLabel(b.event.starts_at)} – {corporateDateLabel(b.event.ends_at)} · {b.event.location}</p><p>Group size: <strong>{b.group_size}</strong>. {b.status === 'Requested' ? 'No places reserved yet.' : ['Pending payment','Pending additional payment','Confirmed','Completed'].includes(b.status) ? 'Accepted places remain reserved.' : 'No active reservation.'}</p><p>{b.notes || 'No additional notes.'}</p>
    {pending && b.payment_due_at && <div className={ui.notice}><strong>{corporateBookingOverdue(b, now) ? 'Payment overdue — booking is not automatically cancelled' : 'Payment pending'}</strong><p>Due {corporateDateLabel(b.payment_due_at)}. Reserved places remain held. Contact the booking team to discuss payment.</p></div>}
    {b.decision_reason && <p className={ui.notice}>Latest decision / external follow-up: {b.decision_reason}</p>}
    <h3>Contact & billing details at submission</h3><dl className={management.profile}><div><dt>Company / MPC</dt><dd>{c.company_name}<br />{c.contact_name}</dd></div><div><dt>Email</dt><dd><a href={'mailto:' + c.contact_email}>{c.contact_email}</a></dd></div><div><dt>Phone</dt><dd><a href={'tel:' + c.contact_phone.replace(/[^+0-9]/g,'')}>{c.contact_phone}</a></dd></div><div><dt>Billing address</dt><dd>{c.billing_address}</dd></div></dl><p>These are the submitted details. Later profile edits do not rewrite this record.</p>{admin && <Link className={styles.secondaryButton} href={'/admin/corporate-accounts?account=' + encodeURIComponent(b.account_id)}>Open current company contact / account</Link>}
    {detail.payments.map(payment => <section key={payment.id} className={ui.notice}><h3>External payment recorded</h3><p>Reference: {payment.reference}<br />Received: {payment.received_on}{payment.additional_amount_snapshot && <><br />Additional payment assessment: R {Number(payment.additional_amount_snapshot).toFixed(2)}</>}<br />Recorded by {payment.recorded_by_name} · {corporateDateLabel(payment.created_at)}</p><p>{payment.note}</p><p>No financial transaction was processed by this portal.</p></section>)}
    {admin && <><div className={ui.actions}>
      {!b.pending_change && (b.status === 'Requested' && settings.booking_enabled || pending) && !started && <button className={styles.primaryButton} onClick={() => changeMode('deadline')}>{b.status === 'Requested' ? 'Accept request & set deadline' : 'Wait / extend deadline'}</button>}
      {!b.pending_change && pending && <button className={styles.primaryButton} onClick={() => changeMode('payment')}>Record external payment & confirm</button>}
      {['Requested','Pending payment','Pending additional payment','Confirmed'].includes(b.status) && <button className={styles.dangerButton} onClick={() => changeMode('reject')}>Reject booking</button>}
    </div>{mode && <section className={ui.notice}><button className={styles.secondaryButton} onClick={() => changeMode('')}>Close decision form</button><CorporateBookingDecisionForm key={mode} mode={mode} booking={b} dirtyChanged={reportDirty} committed={async saved => { reportDirty(false); setMode(''); await committed(saved); }} /></section>}</>}
    {b.event.cancelled_at && <p className={styles.error}>Event cancelled: {b.event.cancellation_reason}. Any payment/refund follow-up happens externally.</p>}
    {pending && b.additional_payment_amount && <p className={ui.notice}>Additional external amount due: R {Number(b.additional_payment_amount).toFixed(2)}. Prior receipts remain recorded.</p>}
    <nav className={ui.tabs} aria-label="Booking workflow detail">{[['changes','Changes & cancellation'],['attendance','Attendance & completion']].map(([key,label]) => <button key={key} aria-pressed={!mode && workflowSection === key} onClick={() => { if (formDirty && !window.confirm('Discard unsaved booking details?')) return; setMode(''); setWorkflowSection(key); reportDirty(false); }}>{label}</button>)}</nav>
    {!mode && workflowSection === 'changes' && <CorporateChangeActions booking={b} admin={admin} settings={settings} dirtyChanged={reportDirty} committed={committed} />}
    {!mode && workflowSection === 'attendance' && <CorporateAttendance booking={b} admin={admin} dirtyChanged={reportDirty} committed={committed} />}
    {Boolean(detail.changes?.length) && <section><h2>Change-request history</h2><p>Latest 50 proposals; earlier records remain in the database.</p><ol className={ui.history}>{detail.changes?.map(change => <li key={change.id}><strong>{change.kind} · {change.status}</strong><time dateTime={change.created_at}>{corporateDateLabel(change.created_at)}</time><p>{change.reason}</p>{change.target_snapshot && <p>Proposed {change.target_snapshot.title}, {corporateDateLabel(change.target_snapshot.starts_at)}, {change.proposed_size} people.</p>}<p>{change.review_note}</p>{change.additional_amount && <p>Additional amount agreed: R {Number(change.additional_amount).toFixed(2)}</p>}</li>)}</ol></section>}
    <WorkflowHistory rows={detail.history} />
  </section>;
}

export function CorporateBookingDecisionForm({ mode, booking, dirtyChanged, committed }: { mode: 'deadline' | 'payment' | 'reject'; booking: CorporateBookingDetail['booking']; dirtyChanged: (value: boolean) => void; committed: (booking: Awaited<ReturnType<typeof rejectCorporateBooking>>) => Promise<void> }) {
  const [deadline, setDeadline] = useState(() => corporateLocalInput(booking.payment_due_at || Math.min(Date.now() + 7 * 86400000, Date.parse(booking.event.starts_at) - 60000)));
  const [reference, setReference] = useState('');
  const [received, setReceived] = useState(corporateLocalInput().slice(0,10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), paymentIntent = useRef<{ key: string; payload: string } | null>(null);
  return <form aria-busy={busy} onChange={() => dirtyChanged(true)} onSubmit={async event => {
    event.preventDefault(); if (pending.current) return;
    if (!window.confirm(mode === 'payment' ? 'Confirm you have verified external payment? This records a receipt and confirms the booking; it does not charge the company.' : mode === 'reject' ? 'Reject this booking and release any held places? Payment/history remains; refunds are handled externally.' : 'Save this deadline? Acceptance rechecks limits and reserves the whole group atomically.')) return;
    pending.current = true; setBusy(true); setError(''); dirtyChanged(true);
    try {
      let saved;
      if (mode === 'deadline') saved = await setCorporatePaymentDeadline(booking, corporateTimestamp(deadline), note);
      else if (mode === 'reject') saved = await rejectCorporateBooking(booking, note);
      else {
        const payload = JSON.stringify([booking.id, reference.trim(), received, note.trim()]);
        if (paymentIntent.current?.payload !== payload) paymentIntent.current = { payload, key: crypto.randomUUID() };
        saved = await recordCorporatePayment(booking, paymentIntent.current.key, reference, received, note);
      }
      dirtyChanged(false); await committed(saved);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Decision could not be saved. Refresh the record before changing your decision.'); }
    finally { pending.current = false; setBusy(false); }
  }}><fieldset className={styles.formGrid} disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>{mode === 'deadline' ? 'Payment deadline & external follow-up' : mode === 'payment' ? 'Verified external receipt' : 'Booking rejection'}</legend>
    {mode === 'deadline' && <label className={styles.field}><span className={styles.fieldLabel}>Due before event starts (SA time)</span><input className={styles.input} type="datetime-local" required value={deadline} onChange={event => setDeadline(event.target.value)} /><small>Future deadline, strictly before {corporateDateLabel(booking.event.starts_at)}.</small></label>}
    {mode === 'payment' && <><label className={styles.field}><span className={styles.fieldLabel}>Payment reference / receipt ID</span><input className={styles.input} required maxLength={180} value={reference} onChange={event => setReference(event.target.value)} /></label><label className={styles.field}><span className={styles.fieldLabel}>Date received</span><input className={styles.input} type="date" required max={corporateLocalInput().slice(0,10)} value={received} onChange={event => setReceived(event.target.value)} /></label></>}
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>{mode === 'payment' ? 'Verification notes (optional)' : mode === 'reject' ? 'Reason / external payment or refund follow-up' : 'External discussion / follow-up note'}</span><textarea className={styles.input} required={mode !== 'payment'} maxLength={800} value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.primaryButton}>{busy ? 'Saving…' : mode === 'payment' ? 'Record payment & confirm' : mode === 'deadline' ? 'Save deadline' : 'Reject booking'}</button>
  </fieldset></form>;
}
