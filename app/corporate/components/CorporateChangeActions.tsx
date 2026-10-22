"use client";

import { useCallback, useRef, useState } from 'react';
import { corporateChangesEnabled } from '@/lib/feature-flags';
import { emptyWorkflowFilters, requestCorporateChange, reviewCorporateChange, searchCorporateEvents } from '@/lib/actions/corporate-bookings';
import type { CorporateBookingRow, CorporateBookingSettings, CorporateEvent } from '@/lib/corporate-booking-types';
import { corporateDateLabel, corporateLocalInput, corporateTimestamp } from '@/lib/corporate-booking-utils';
import { FeatureState, useFeatureData } from '@/app/admin/components/FeatureShared';
import { useWorkflowClock, WorkflowFilters, WorkflowPagination } from './CorporateWorkflowShared';
import styles from '@/app/admin/admin.module.css';
import management from '@/app/admin/components/management.module.css';
import ui from '../corporate.module.css';

type ChangeProps = { booking: CorporateBookingRow; admin: boolean; settings: CorporateBookingSettings; dirtyChanged: (dirty: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void> };

/** Requests are proposals, not edits: the original reservation stays visible until a checked decision. */
export default function CorporateChangeActions({ booking, admin, settings, dirtyChanged, committed }: ChangeProps) {
  const [mode, setMode] = useState<'' | 'Amendment' | 'Cancellation' | 'approve' | 'decline'>('');
  const [dirty, setDirty] = useState(false);
  const now = useWorkflowClock(), pending = booking.pending_change;
  const reportDirty = (value: boolean) => { setDirty(value); dirtyChanged(value); };
  const selectMode = (next: typeof mode) => { if (dirty && !window.confirm('Discard your unsaved change-request form?')) return; setMode(next); reportDirty(false); };
  const canRequest = !admin && settings.changes_enabled && !pending && !booking.event.cancelled_at && Date.parse(booking.event.starts_at) > now && ['Requested','Pending payment','Pending additional payment','Confirmed'].includes(booking.status);
  return <section><h2>Changes & cancellation</h2>
    {pending && <div className={ui.notice}><strong>{pending.kind === 'Amendment' ? 'Booking change' : 'Cancellation'} awaiting admin review</strong><p>{pending.reason}</p><p>Requested {corporateDateLabel(pending.created_at)}. The original booking and its places remain unchanged.</p>{pending.target_snapshot && <p>Proposed: {pending.target_snapshot.title} · {corporateDateLabel(pending.target_snapshot.starts_at)} to {corporateDateLabel(pending.target_snapshot.ends_at)} · {pending.target_snapshot.location}<br />{pending.proposed_size} people. Proposed places are not reserved.</p>}</div>}
    {!corporateChangesEnabled ? <p>Online change requests are not enabled yet. Contact the booking team.</p> : <>
      {!settings.changes_enabled && <p>New requests and amendment approvals are closed. Admin can still decline a proposal or review an existing cancellation.</p>}
      {canRequest && <div className={ui.actions}><button className={styles.secondaryButton} onClick={() => selectMode('Amendment')}>Request booking change</button><button className={styles.dangerButton} onClick={() => selectMode('Cancellation')}>Request cancellation</button></div>}
      {!admin && Date.parse(booking.event.starts_at) <= now && <p>Online changes close at the event start. Contact the booking team for operational follow-up.</p>}
      {admin && pending && <div className={ui.actions}><button className={styles.primaryButton} disabled={pending.kind === 'Amendment' && (!settings.changes_enabled || Date.parse(booking.event.starts_at) <= now)} onClick={() => selectMode('approve')}>Review & approve {pending.kind.toLowerCase()}</button><button className={styles.secondaryButton} onClick={() => selectMode('decline')}>Decline {pending.kind.toLowerCase()}</button></div>}
      {mode && <section className={ui.notice}><button className={styles.secondaryButton} onClick={() => selectMode('')}>Close request form</button>
        {(mode === 'Amendment' || mode === 'Cancellation') && <CorporateChangeRequestForm key={mode} booking={booking} kind={mode} dirtyChanged={reportDirty} committed={async saved => { reportDirty(false); setMode(''); await committed(saved); }} />}
        {(mode === 'approve' || mode === 'decline') && pending && <CorporateChangeReviewForm key={mode} booking={booking} approve={mode === 'approve'} dirtyChanged={reportDirty} committed={async saved => { reportDirty(false); setMode(''); await committed(saved); }} />}
      </section>}
    </>}
    <p>Any payment adjustment or refund is agreed externally. Previous receipts and submitted contact/billing details are retained.</p>
  </section>;
}

export function CorporateChangeRequestForm({ booking, kind, dirtyChanged, committed }: { booking: CorporateBookingRow; kind: 'Amendment' | 'Cancellation'; dirtyChanged: (dirty: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void> }) {
  const [filters, setFilters] = useState(emptyWorkflowFilters), [page, setPage] = useState(1);
  const [target, setTarget] = useState<CorporateEvent | null>(null), [size, setSize] = useState(String(booking.group_size));
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false), intent = useRef<{ key: string; payload: string } | null>(null);
  const loader = useCallback(() => kind === 'Amendment' ? searchCorporateEvents(filters, page) : Promise.resolve({ rows: [], total: 0 }), [kind, filters, page]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  // For a same-event change, the company's existing accepted places count towards its new size.
  const available = (event: CorporateEvent) => event.remaining + (event.id === booking.event_id && booking.status !== 'Requested' ? booking.group_size : 0);
  return <div><h3>{kind === 'Amendment' ? 'Propose a different event or group size' : 'Request cancellation'}</h3><p>Current: {booking.event.title}, {corporateDateLabel(booking.event.starts_at)}, {booking.group_size} people.</p>
    {kind === 'Amendment' && <section><WorkflowFilters value={filters} disabled={busy} change={value => { setFilters(value); setPage(1); }} /><FeatureState loading={loading} error={loadError} retry={() => void reload()} />{!loading && !loadError && <><div className={management.tableViewport}><table className={styles.table}><thead><tr><th>Proposed corporate event</th><th>Group limits / available including own places</th><th>Select</th></tr></thead><tbody>{data?.rows.map(event => <tr key={event.id}><td>{event.title}<small className={management.subtle}>{corporateDateLabel(event.starts_at)} – {corporateDateLabel(event.ends_at)}<br />{event.location}</small></td><td>{event.min_group_size}–{event.max_group_size} / {available(event)}</td><td><button className={styles.secondaryButton} disabled={busy || event.state === 'Cancelled' || available(event) < event.min_group_size} onClick={() => { setTarget(event); dirtyChanged(true); }}>Select {event.title}</button></td></tr>)}{!data?.rows.length && <tr><td colSpan={3}>No matching future published events. Contact the booking team.</td></tr>}</tbody></table></div><WorkflowPagination page={page} total={data?.total ?? 0} disabled={busy} change={setPage} /></>}</section>}
    <form aria-busy={busy} onChange={() => dirtyChanged(true)} onSubmit={async event => {
      event.preventDefault(); if (pending.current) return; setError('');
      if (kind === 'Amendment' && (!target || !Number.isInteger(Number(size)) || Number(size) < target.min_group_size || Number(size) > Math.min(target.max_group_size, available(target)))) { setError('Select a proposed event and a whole-number group size within its limits and available places.'); return; }
    if (Date.parse(booking.event.starts_at) <= Date.now()) { setError('The original event has started. Contact the booking team for follow-up.'); return; }
    if (!window.confirm('Submit this proposal? Your original booking stays unchanged until admin reviews it.')) return;
      const payload = JSON.stringify([booking.id, booking.version, kind, target?.id, target?.version, size, reason.trim()]);
      if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() };
      pending.current = true; setBusy(true); dirtyChanged(true);
      try { const saved = await requestCorporateChange(booking, kind, target, kind === 'Amendment' ? Number(size) : null, reason, intent.current.key); dirtyChanged(false); await committed(saved); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Request could not be submitted. Refresh to check before changing your request.'); }
      finally { pending.current = false; setBusy(false); }
    }}><fieldset className={styles.formGrid} disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>Proposal details</legend>{kind === 'Amendment' && <><p className={styles.fieldFull}>{target ? `Selected: ${target.title} · ${corporateDateLabel(target.starts_at)} · ${target.location}` : 'Select an event above, including the current event if only the group size is changing.'}</p><label className={styles.field}><span className={styles.fieldLabel}>Proposed group size</span><input className={styles.input} type="number" step={1} min={target?.min_group_size || 1} max={target ? Math.min(target.max_group_size, available(target)) : undefined} required value={size} onChange={event => setSize(event.target.value)} /></label></>}
      <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Reason for {kind.toLowerCase()}</span><textarea className={styles.input} required maxLength={800} value={reason} onChange={event => setReason(event.target.value)} /></label>{error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.primaryButton}>{busy ? 'Submitting…' : 'Send request for review'}</button>
    </fieldset></form>
  </div>;
}

export function CorporateChangeReviewForm({ booking, approve, dirtyChanged, committed }: { booking: CorporateBookingRow; approve: boolean; dirtyChanged: (dirty: boolean) => void; committed: (booking: CorporateBookingRow) => Promise<void> }) {
  const [extra, setExtra] = useState(false), [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState(booking.payment_due_at ? corporateLocalInput(booking.payment_due_at) : '');
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false), proposal = booking.pending_change!;
  const paymentControls = approve && proposal.kind === 'Amendment', needsDeadline = paymentControls && (extra || booking.status.startsWith('Pending'));
  return <form aria-busy={busy} onChange={() => dirtyChanged(true)} onSubmit={async event => {
    event.preventDefault(); if (pending.current) return; setError('');
    if (!window.confirm(approve ? proposal.kind === 'Amendment' ? 'Approve the proposal? Capacity and deadlines will be checked again. Any failed transfer keeps the original booking.' : 'Approve cancellation and release held places? Receipts/history remain; refunds happen externally.' : 'Decline this proposal and retain the original booking?')) return;
    pending.current = true; setBusy(true); dirtyChanged(true);
    try { const saved = await reviewCorporateChange(booking, proposal.id, approve, note, paymentControls && extra ? Number(amount) : null, needsDeadline ? corporateTimestamp(deadline) : null); dirtyChanged(false); await committed(saved); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Decision could not be saved. Refresh and review the latest details.'); }
    finally { pending.current = false; setBusy(false); }
  }}><fieldset className={styles.formGrid} disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}><legend>{approve ? 'Approve' : 'Decline'} {proposal.kind.toLowerCase()}</legend>
    {paymentControls && booking.status === 'Confirmed' && <label className={`${management.preference} ${styles.fieldFull}`}><input type="checkbox" checked={extra} onChange={event => setExtra(event.target.checked)} />Additional external payment agreed for this change</label>}
    {paymentControls && extra && <label className={styles.field}><span className={styles.fieldLabel}>Additional amount (ZAR)</span><input className={styles.input} type="number" min="0.01" max="9999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></label>}
    {needsDeadline && <label className={styles.field}><span className={styles.fieldLabel}>Future payment deadline before proposed event (SA time)</span><input className={styles.input} required type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} /></label>}
    <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Decision / external payment or refund follow-up note</span><textarea className={styles.input} required maxLength={800} value={note} onChange={event => setNote(event.target.value)} /></label><p className={styles.fieldFull}>No automatic pricing, charge or refund. Earlier payments stay recorded. An unaccepted booking remains Requested after an approved change.</p>{error && <p className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</p>}<button className={styles.primaryButton}>{busy ? 'Saving…' : approve ? 'Approve request' : 'Decline request'}</button>
  </fieldset></form>;
}
