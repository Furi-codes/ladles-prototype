"use client";
/**
 * Shows corporate bookings in calendar/list form and opens a booking review.
 * The attendance queue reuses this screen with a fixed filter, while committed changes are kept
 * visible even if a later refresh fails.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CorporateBookingDetail, CorporateBookingSettings, CorporateWorkflowFilters } from '@/features/corporate/types/bookings';
import { adminNoticesChanged } from '@/features/admin/services/notifications';
import { emptyWorkflowFilters, getCorporateBookingDetail, recordCorporatePayment, rejectCorporateBooking, searchCorporateBookings, setCorporatePaymentDeadline } from '@/features/corporate/services/bookings';
import { corporateBookingOverdue, corporateBookingNextStep, corporateBookingReference, corporateDateLabel, corporateLocalInput, corporateTimestamp } from '@/features/corporate/utils/bookings';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { FeatureState } from '@/components/ui/FeatureShared';
import { useCorporateFeatureData as useFeatureData } from '@/features/corporate/hooks/useCorporateFeatureData';
import { useWorkflowClock, WorkflowFilters, WorkflowHistory, WorkflowPagination } from '@/features/corporate/shared/CorporateWorkflowShared';
import CorporateChangeActions from '@/features/corporate/bookings/CorporateChangeActions';
import CorporateAttendance from '@/features/corporate/attendance/CorporateAttendance';
import CorporateCalendar from '@/features/corporate/calendar/CorporateCalendar';
import { corporateOutcomesEnabled } from '@/lib/config/features';
import { canRecordCorporateAttendance } from '@/features/corporate/utils/outcomes';
import ContactOptions from '@/components/contacts/ContactOptions';
import styles from '@/styles/admin.module.css';
import management from '@/components/ui/management.module.css';
import ui from '@/styles/corporate.module.css';

export default function CorporateBookingList({ admin = false, attendanceOnly = false, initialDetail = null, settings, dirtyChanged }: {
  admin?: boolean; attendanceOnly?: boolean; initialDetail?: CorporateBookingDetail | null; settings: CorporateBookingSettings; dirtyChanged?: (dirty: boolean) => void;
}) {
  const attendanceQueue = admin && attendanceOnly;
  const [filters, setFilters] = useState<CorporateWorkflowFilters>(() => ({...emptyWorkflowFilters,...(attendanceQueue ? {status:'Attendance to record' as const} : {})}));
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'calendar' | 'list'>(attendanceQueue ? 'list' : 'calendar');
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [detail, setDetail] = useState(initialDetail);
  const [dirty, setDirty] = useState(false), [opening, setOpening] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [detailEpoch, setDetailEpoch] = useState(0);
  const now = useWorkflowClock();
  const confirmDiscard = useUnsavedChanges(dirty);
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged?.(value); };
  const loader = useCallback(() => view === 'list'
    ? searchCorporateBookings(attendanceQueue ? {...filters,status:'Attendance to record'} : filters, page)
    : Promise.resolve({ rows: [], total: 0 }), [filters, page, view, attendanceQueue]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  useEffect(() => {
    if (!attendanceQueue || dirty || opening || typeof window === 'undefined') return;
    // Sessions can end while this queue is open. Never interrupt an attendance draft.
    const timer = window.setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void reload(); }, 60000);
    return () => window.clearInterval(timer);
  }, [attendanceQueue, dirty, opening, reload]);
  /**
   * Check the dirty-form guard before fetching a review. Incrementing the detail epoch resets
   * the form when the same booking is deliberately reopened.
   */
  async function open(id: string) {
    if (opening || !confirmDiscard()) return;
    setOpening(true); setError('');
    try { setDetail(await getCorporateBookingDetail(id)); setDetailEpoch(current => current + 1); reportDirty(false); }
    catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Booking could not be opened.', "Booking could not be opened.")); }
    finally { setOpening(false); }
  }
  return <div className={[management.workspace,ui.workspace].join(' ')}>
    <div className={styles.pageHeading}><div>
      <h1 className={styles.pageTitle}>{attendanceQueue ? 'Attendance to record' : admin ? 'Corporate booking requests' : 'My bookings'}</h1>
      <p className={styles.pageDescription}>{attendanceQueue ? 'Confirmed sessions that have ended and still need group attendance.' : admin ? 'Review requests, manage payment deadlines and confirm group bookings.' : 'Track your requests, payment deadlines and confirmed group bookings.'}</p>
    </div>{attendanceQueue && <button type="button" className={styles.secondaryButton} disabled={loading || dirty || opening} onClick={() => void reload()}>Refresh queue</button>}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={ui.notice} role="status">{message}</p>}
    <section className={styles.card}>
      <WorkflowFilters value={filters} statuses={!attendanceQueue} attendance={admin && corporateOutcomesEnabled} disabled={dirty || opening} change={value => { setFilters(attendanceQueue ? {...value,status:'Attendance to record'} : value); setPage(1); }} />
      {!attendanceQueue && <div className={ui.viewToggle} aria-label="Booking view">
        <button type="button" className={view === 'calendar' ? styles.primaryButton : styles.secondaryButton} aria-pressed={view === 'calendar'} disabled={dirty || opening} onClick={() => setView('calendar')}>Calendar</button>
        <button type="button" className={view === 'list' ? styles.primaryButton : styles.secondaryButton} aria-pressed={view === 'list'} disabled={dirty || opening} onClick={() => setView('list')}>List</button>
      </div>}
      {view === 'calendar'
        ? <CorporateCalendar key={filters.from + ':' + filters.to} mode="bookings" filters={filters} admin={admin} now={now} disabled={dirty || opening} revision={calendarRevision} onBooking={id => void open(id)} />
        : <>
          <FeatureState loading={loading} error={loadError} retry={() => void reload()} />
          {!loading && !loadError && <>
            <div className={`${management.tableViewport} ${ui.responsiveTable}`}>
              <table role="table" aria-label={attendanceQueue ? 'Corporate attendance to record' : 'Corporate bookings'} className={styles.table}>
                <thead role="rowgroup"><tr role="row">
                  <th role="columnheader" scope="col">Company / booking</th><th role="columnheader" scope="col">Event (SA time)</th>
                  <th role="columnheader" scope="col">Group</th><th role="columnheader" scope="col">Status</th>
                  <th role="columnheader" scope="col">{attendanceQueue ? 'Attendance' : 'Payment deadline'}</th><th role="columnheader" scope="col">Actions</th>
                </tr></thead>
                <tbody role="rowgroup">{data?.rows.map(booking => <tr role="row" key={booking.id}>
                  <td role="cell" data-label="Company / booking">{booking.contact_snapshot.company_name}<small className={management.subtle}>{booking.contact_snapshot.contact_name}<br />{corporateBookingReference(booking.id)}</small></td>
                  <td role="cell" data-label="Event (SA time)">{booking.event.title}<small className={management.subtle}>{corporateDateLabel(booking.event.starts_at)}<br />{booking.event.location}</small></td>
                  <td role="cell" data-label="Group size">{booking.group_size}</td>
                  <td role="cell" data-label="Status"><span className={ui.badge}>{booking.status}</span>{booking.pending_change && <p>{booking.pending_change.kind} requested</p>}{corporateBookingOverdue(booking, now) && <p>Overdue · session remains reserved</p>}</td>
                  <td role="cell" data-label={attendanceQueue ? 'Attendance' : 'Payment deadline'}>{attendanceQueue ? booking.pending_change ? 'Resolve the outstanding request first' : 'Not recorded' : booking.status.startsWith('Pending') && booking.payment_due_at ? corporateDateLabel(booking.payment_due_at) : '—'}</td>
                  <td role="cell" data-label="Actions"><button className={attendanceQueue && canRecordCorporateAttendance(booking,now) ? styles.primaryButton : styles.secondaryButton} disabled={opening} onClick={() => void open(booking.id)}>{attendanceQueue && canRecordCorporateAttendance(booking,now) ? 'Record attendance' : admin ? 'Review booking' : 'Details'}</button></td>
                </tr>)}{!data?.rows.length && <tr role="row"><td role="cell" colSpan={6}>{attendanceQueue ? 'No matching attendance to record.' : 'No matching bookings.'}</td></tr>}</tbody>
              </table>
            </div>
            <WorkflowPagination page={page} total={data?.total ?? 0} change={setPage} disabled={dirty || opening} />
          </>}
        </>}
    </section>
    {detail && <CorporateBookingPanel key={detail.booking.id + ':' + detail.booking.version + ':' + detailEpoch} detail={detail} admin={admin} attendanceFocus={attendanceQueue} settings={settings} dirtyChanged={reportDirty} refresh={() => void open(detail.booking.id)} committed={async saved => {
      // Keep the committed result visible even if a receipt/history refresh fails.
      setDetail(current => current ? { ...current, booking: { ...current.booking, ...saved } } : null); reportDirty(false); setMessage('Booking updated. The latest details are shown below.');
      if (admin && saved.status === 'Completed') window.dispatchEvent(new Event(adminNoticesChanged));
      try { setDetail(await getCorporateBookingDetail(saved.id)); } catch { setMessage('Decision saved, but receipt/history refresh failed. Refresh this booking to load its latest details.'); }
      setCalendarRevision(current => current + 1); void reload();
    }} />}
  </div>;
}

type PanelProps = { detail: CorporateBookingDetail; admin: boolean; attendanceFocus?: boolean; settings: CorporateBookingSettings; dirtyChanged: (dirty: boolean) => void; refresh: () => void; committed: (booking: CorporateBookingDetail['booking'] | Awaited<ReturnType<typeof rejectCorporateBooking>>) => Promise<void> };
/**
 * Show the booking snapshot, payment record, changes and attendance together. The role/status
 * determines which controls can be displayed.
 */
export function CorporateBookingPanel({ detail, admin, attendanceFocus = false, settings, dirtyChanged, refresh, committed }: PanelProps) {
  const panel = useRef<HTMLElement>(null);
  // Details can open below a long results table. Bring the selected record into view once it mounts.
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: 'start' }); }, []);
  const [mode, setMode] = useState<'' | 'deadline' | 'payment' | 'reject'>('');
  const [formDirty, setFormDirty] = useState(false);
  const [workflowSection, setWorkflowSection] = useState(() => corporateOutcomesEnabled && (attendanceFocus || detail.booking.attendance || canRecordCorporateAttendance(detail.booking)) ? 'attendance' : 'changes');
  const now = useWorkflowClock(), b = detail.booking, c = b.contact_snapshot;
  const reportDirty = (value: boolean) => { setFormDirty(value); dirtyChanged(value); };
  const changeMode = (value: typeof mode) => { if (formDirty && !window.confirm('Discard your unsaved booking decision?')) return; setMode(value); reportDirty(false); };
  const pending = b.status.startsWith('Pending'), started = Date.parse(b.event.starts_at) <= now;
  return <section ref={panel} tabIndex={-1} aria-label="Selected booking" className={[styles.card,ui.bookingPanel,ui.focusTarget].join(' ')}>
    <header className={ui.recordHeader}>
      <div><p className={ui.eyebrow}>Booking details</p><h2>{b.event.title}</h2><p className={ui.muted}>{c.company_name} · {b.event.location}</p></div>
      <div className={ui.actions}><span className={ui.badge} data-status={b.status}>{b.status}</span><button type="button" className={styles.secondaryButton} onClick={refresh}>Refresh record</button></div>
    </header>
    <dl className={ui.recordOverview}>
      <div><dt>Starts · South African time</dt><dd>{corporateDateLabel(b.event.starts_at)}</dd></div>
      <div><dt>Ends · South African time</dt><dd>{corporateDateLabel(b.event.ends_at)}</dd></div>
      <div><dt>Group size</dt><dd>{b.group_size} people</dd></div>
    </dl>
    <p className={ui.recordReference}>{corporateBookingReference(b.id)}</p>
    <p className={ui.muted}>{b.status === 'Requested' ? 'Request only — session not reserved.' : ['Pending payment','Pending additional payment','Confirmed','Completed'].includes(b.status) ? 'Exclusive session reserved for this company.' : 'No active reservation.'}</p>
    {b.notes && <div className={ui.notice}><strong>Booking notes</strong><p>{b.notes}</p></div>}
    {!admin && <p className={ui.notice} role="status">{corporateBookingNextStep(b, now)}</p>}
    {pending && b.payment_due_at && <div className={ui.notice}><strong>{corporateBookingOverdue(b, now) ? 'Payment overdue — reservation retained' : 'Payment pending'}</strong><p>Due {corporateDateLabel(b.payment_due_at)}. The session remains reserved until admin acts.</p></div>}
    {b.decision_reason && <div className={ui.notice}><strong>Latest decision / follow-up</strong><p>{b.decision_reason}</p></div>}
    {b.event.cancelled_at && <p className={styles.error}>Event cancelled: {b.event.cancellation_reason}. Any payment/refund follow-up happens externally.</p>}
    {pending && b.additional_payment_amount && <p className={ui.notice}>Additional external amount due: R {Number(b.additional_payment_amount).toFixed(2)}. Prior receipts remain recorded.</p>}

    <section className={ui.recordSection} aria-label="Company contact and billing">
      <div><h2>Company & contact</h2><p className={ui.muted}>Details provided with this booking. Later profile edits do not rewrite this record.</p></div>
      <dl className={management.profile}><div><dt>Company / main contact</dt><dd>{c.company_name}<br />{c.contact_name}</dd></div><div><dt>Email</dt><dd>{c.contact_email}</dd></div><div><dt>Phone</dt><dd>{c.contact_phone}</dd></div><div><dt>Billing address</dt><dd>{c.billing_address}</dd></div></dl>
      {admin && <div className={ui.contactActions}><Link className={styles.secondaryButton} href={'/admin/corporate-accounts?account=' + encodeURIComponent(b.account_id)}>View company account</Link><ContactOptions email={c.contact_email} phone={c.contact_phone} label="Contact company" /></div>}
    </section>

    {detail.payments.length > 0 && <section className={ui.recordSection} aria-label="Recorded payments"><div><h2>Payment records</h2><p className={ui.muted}>Payments were handled externally. These entries confirm what admin recorded.</p></div><div className={ui.paymentList}>{detail.payments.map(payment => <article key={payment.id} className={ui.paymentRecord}>
      <div className={ui.sectionHeader}><h3>External payment recorded</h3><span className={ui.badge} data-status="Confirmed">Recorded</span></div>
      <dl className={ui.paymentMeta}><div><dt>Payment reference</dt><dd>{payment.reference}</dd></div><div><dt>Date received</dt><dd>{payment.received_on}</dd></div><div><dt>Recorded by</dt><dd>{payment.recorded_by_name}<br /><span className={ui.muted}>{corporateDateLabel(payment.created_at)}</span></dd></div></dl>
      {payment.additional_amount_snapshot && <p>Additional payment assessment: R {Number(payment.additional_amount_snapshot).toFixed(2)}</p>}
      {payment.note && <p>{payment.note}</p>}
    </article>)}</div></section>}

    {admin && ['Requested','Pending payment','Pending additional payment','Confirmed'].includes(b.status) && <section className={[ui.recordSection,ui.decisionArea].join(' ')} aria-label="Booking decisions">
      <div><h2>Manage booking</h2><p>Choose an action below. Changes are only saved after you complete and confirm the form.</p></div>
      <div className={ui.decisionButtons}>
        {!b.pending_change && (b.status === 'Requested' && settings.booking_enabled || pending) && !started && <button type="button" className={b.status === 'Requested' ? styles.primaryButton : styles.secondaryButton} aria-pressed={mode === 'deadline'} onClick={() => changeMode('deadline')}>{b.status === 'Requested' ? 'Accept request & set deadline' : 'Wait / extend deadline'}</button>}
        {!b.pending_change && pending && <button type="button" className={styles.primaryButton} aria-pressed={mode === 'payment'} onClick={() => changeMode('payment')}>Record external payment & confirm</button>}
        <button type="button" className={styles.dangerButton} aria-pressed={mode === 'reject'} onClick={() => changeMode('reject')}>Reject booking</button>
      </div>
      {mode && <section className={ui.inlineForm} aria-label="Booking decision form"><div className={ui.sectionHeader}><h3>{mode === 'payment' ? 'Confirm an external payment' : mode === 'deadline' ? 'Set the payment deadline' : 'Reject this booking'}</h3><button type="button" className={styles.secondaryButton} onClick={() => changeMode('')}>Close decision form</button></div><CorporateBookingDecisionForm key={mode} mode={mode} booking={b} dirtyChanged={reportDirty} committed={async saved => { reportDirty(false); setMode(''); await committed(saved); }} /></section>}
    </section>}

    <section className={ui.recordSection}>
      <nav className={ui.tabs} aria-label="Booking workflow detail">{[['changes','Changes & cancellation'],['attendance','Attendance & completion']].map(([key,label]) => <button type="button" key={key} aria-pressed={!mode && workflowSection === key} onClick={() => { if (formDirty && !window.confirm('Discard unsaved booking details?')) return; setMode(''); setWorkflowSection(key); reportDirty(false); }}>{label}</button>)}</nav>
      <div className={ui.workflowPane}>
        {!mode && workflowSection === 'changes' && <CorporateChangeActions booking={b} admin={admin} settings={settings} dirtyChanged={reportDirty} committed={committed} />}
        {!mode && workflowSection === 'attendance' && <CorporateAttendance booking={b} admin={admin} initialOpen={attendanceFocus} dirtyChanged={reportDirty} committed={committed} />}
      </div>
    </section>
    {Boolean(detail.changes?.length) && <section className={[ui.recordSection,ui.historySection].join(' ')}><h2>Change-request history</h2><ol className={ui.history}>{detail.changes?.map(change => <li key={change.id}><strong>{change.kind} · {change.status}</strong><time dateTime={change.created_at}>{corporateDateLabel(change.created_at)}</time><p>{change.reason}</p>{change.target_snapshot && <p>Proposed {change.target_snapshot.title}, {corporateDateLabel(change.target_snapshot.starts_at)}, {change.proposed_size} people.</p>}{change.review_note && <p>{change.review_note}</p>}{change.additional_amount && <p>Additional amount agreed: R {Number(change.additional_amount).toFixed(2)}</p>}</li>)}</ol></section>}
    <div className={ui.recordSection}><WorkflowHistory rows={detail.history} /></div>
  </section>;
}

/**
 * Collect the selected admin decision and send its versioned operation. The caller refreshes the
 * review after a committed result.
 */
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
    if (!window.confirm(mode === 'payment' ? 'Confirm you have verified external payment? This records a receipt and confirms the booking; it does not charge the company.' : mode === 'reject' ? 'Reject this booking and release its exclusive session? Payment/history remains; refunds are handled externally.' : 'Save this deadline? Acceptance reserves the whole session and declines competing requests atomically.')) return;
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
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Decision could not be saved. Refresh the record before changing your decision.', "Decision could not be saved. Refresh the record before changing your decision.")); }
    finally { pending.current = false; setBusy(false); }
  }}><fieldset className={styles.formGrid} disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>{mode === 'deadline' ? 'Payment deadline & external follow-up' : mode === 'payment' ? 'Verified external receipt' : 'Booking rejection'}</legend>
    {mode === 'deadline' && <label className={styles.field}><span className={styles.fieldLabel}>Due before event starts (SA time)</span><input className={styles.input} type="datetime-local" required value={deadline} onChange={event => setDeadline(event.target.value)} /><small>Future deadline, strictly before {corporateDateLabel(booking.event.starts_at)}.</small></label>}
    {mode === 'payment' && <><label className={styles.field}><span className={styles.fieldLabel}>Payment reference / receipt ID</span><input className={styles.input} required maxLength={180} value={reference} onChange={event => setReference(event.target.value)} /></label><label className={styles.field}><span className={styles.fieldLabel}>Date received</span><input className={styles.input} type="date" required max={corporateLocalInput().slice(0,10)} value={received} onChange={event => setReceived(event.target.value)} /></label></>}
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>{mode === 'payment' ? 'Verification notes (optional)' : mode === 'reject' ? 'Reason / external payment or refund follow-up' : 'External discussion / follow-up note'}</span><textarea className={styles.input} required={mode !== 'payment'} maxLength={800} value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<div className={ui.formFooter}><button type="submit" className={styles.primaryButton}>{busy ? 'Saving…' : mode === 'payment' ? 'Record payment & confirm' : mode === 'deadline' ? 'Save deadline' : 'Reject booking'}</button></div>
  </fieldset></form>;
}
