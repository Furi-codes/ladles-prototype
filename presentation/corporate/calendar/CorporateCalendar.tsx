"use client";

/**
 * Shows corporate sessions or bookings in a shared month calendar.
 * The month follows today in South African time until the user browses elsewhere, and details
 * stay outside the date cells.
 */

import { useCallback, useState } from 'react';
import type { CorporateBookingRow, CorporateEvent, CorporateWorkflowFilters } from '@/business/corporate/types/bookings';
import { searchCorporateBookings, searchCorporateEvents } from '@/business/corporate/services/bookings';
import { calendarDate, calendarFilters, calendarLabel, calendarMonthDays, calendarTime, canRequestCorporateSession, loadCalendarRows, moveCalendarMonth, sessionPresentation } from '@/business/corporate/utils/calendar';
import { corporateBookingOverdue } from '@/business/corporate/utils/bookings';
import { corporateChangesEnabled } from '@/business/shared/config/features';
import { FeatureState } from '@/presentation/components/ui/FeatureShared';
import { useCorporateFeatureData as useFeatureData } from '@/presentation/corporate/hooks/useCorporateFeatureData';
import styles from '@/presentation/styles/admin.module.css';
import ui from '@/presentation/styles/corporate.module.css';
import css from '@/presentation/corporate/calendar/corporate-calendar.module.css';

type CalendarProps = {
  mode: 'events' | 'bookings'; filters: CorporateWorkflowFilters; admin: boolean; now: number;
  disabled?: boolean; requestsOpen?: boolean; revision?: number;
  onEvent?: (event: CorporateEvent) => void; onCancelEvent?: (event: CorporateEvent) => void;
  onBooking?: (id: string) => void; onCreateDate?: (date: string) => void;
};

/** The same month view serves event availability and company booking review. Existing RPCs still enforce access. */
export default function CorporateCalendar({ mode, filters, admin, now, disabled = false, requestsOpen = false, revision = 0, onEvent, onCancelEvent, onBooking, onCreateDate }: CalendarProps) {
  const today = calendarDate(now);
  // Follow South Africa's current date until someone intentionally browses another
  // month. Deriving it from the clock also handles a tab left open over midnight.
  const [browsedMonth, setBrowsedMonth] = useState<string | null>(() => filters.from ? filters.from.slice(0, 7) : null);
  const month = browsedMonth ?? today.slice(0, 7);
  const [selection, setSelection] = useState<{ month: string; date: string } | null>(null);
  const selected = selection?.month === month ? selection.date : today.startsWith(month) ? today : null;
  const scope = JSON.stringify([mode, month, filters, revision]);
  const loader = useCallback(async () => {
    const bounded = calendarFilters(month, filters);
    const rows = !bounded ? [] : mode === 'events'
      ? await loadCalendarRows(page => searchCorporateEvents(bounded, page))
      : await loadCalendarRows(page => searchCorporateBookings(bounded, page));
    return { scope, rows };
  }, [mode, month, filters, scope]);
  const { data, loading, error, reload } = useFeatureData(loader);
  // A previous month's result must never make dates in a new month appear available.
  const ready = !loading && data?.scope === scope && !error;
  const events = ready && mode === 'events' ? data.rows as CorporateEvent[] : [];
  const bookings = ready && mode === 'bookings' ? data.rows as CorporateBookingRow[] : [];
  const dayEvents = (date: string) => events.filter(event => calendarDate(event.starts_at) === date);
  const dayBookings = (date: string) => bookings.filter(booking => calendarDate(booking.event.starts_at) === date);
  const available = (event: CorporateEvent) => canRequestCorporateSession(event,now);
  const presentation = (event: CorporateEvent) => {
    const state = sessionPresentation(event, now);
    // A company can retain an old booking after its session closes to new requests.
    return !admin && state.state === 'unpublished' ? { ...state, label: 'Closed to new requests' } : state;
  };
  const changeMonth = (next: string | null) => { if (!disabled) { setBrowsedMonth(next); setSelection(null); } };
  const selectedEvents = selected ? dayEvents(selected) : [];
  const selectedBookings = selected ? dayBookings(selected) : [];
  function moveDayFocus(event: React.KeyboardEvent<HTMLButtonElement>, date: string) {
    const table=event.currentTarget.closest('table');
    if (!table) return;
    const amount=event.key==='ArrowRight' ? 1 : event.key==='ArrowLeft' ? -1 : event.key==='ArrowDown' ? 7 : event.key==='ArrowUp' ? -7 : 0;
    if (event.key==='Home' || event.key==='End') {
      const row=Array.from(event.currentTarget.closest('tr')?.querySelectorAll<HTMLButtonElement>('button[data-calendar-date]:not(:disabled)') || []);
      (event.key==='Home' ? row[0] : row.at(-1))?.focus();event.preventDefault();return;
    }
    if (!amount) return;
    event.preventDefault();let next=new Date(date+'T12:00:00+02:00');
    // Skip disabled cells without leaving this displayed month or the calendar table.
    for(let attempt=0;attempt<31;attempt++) {
      next=new Date(next.getTime()+amount*86400000);
      const target=table.querySelector<HTMLButtonElement>(`button[data-calendar-date="${calendarDate(next.getTime())}"]`);
      if(!target) return;if(!target.disabled){target.focus();return;}
    }
  }
  return <div className={css.calendar}>
    <div className={css.toolbar}><div><h2>{mode === 'events' ? 'Choose a date and time' : 'Booking calendar'}</h2><p>Dates and times are shown in South African time.</p></div><div className={ui.actions}>
      <button type="button" className={styles.secondaryButton} aria-label="Previous month" disabled={disabled || month === '1900-01'} onClick={() => changeMonth(moveCalendarMonth(month, -1))}>‹</button>
      <label className={css.monthPicker}><span className={css.srOnly}>Calendar month</span><input type="month" min="1900-01" max="9998-12" required value={month} disabled={disabled} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && event.target.value >= '1900-01' && event.target.value <= '9998-12') changeMonth(event.target.value); }} /></label>
      <button type="button" className={styles.secondaryButton} aria-label="Next month" disabled={disabled || month === '9998-12'} onClick={() => changeMonth(moveCalendarMonth(month, 1))}>›</button>
      <button type="button" className={styles.secondaryButton} disabled={disabled} onClick={() => changeMonth(null)}>Today</button>
      <button type="button" className={styles.secondaryButton} disabled={disabled || loading} onClick={() => void reload()}>Refresh</button>
    </div></div>
    <FeatureState loading={loading || !ready && !error} error={error} retry={() => void reload()} />
    <ul className={css.legend} aria-label="Session status legend">{[['available','Available'],['reserved','Reserved'],...(admin ? [['unpublished','Unpublished']] : []),['cancelled','Cancelled'],['past','Past session']].map(([state,label]) => <li key={state}><span className={css.status} data-state={state}>{label}</span></li>)}</ul>
    <div className={css.layout}>
      <div><table className={css.month} aria-label={calendarLabel(month, true)} aria-busy={!ready}><thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <th key={day} scope="col">{day}</th>)}</tr></thead><tbody>{calendarMonthDays(month).map((week, index) => <tr key={index}>{week.map((date, column) => {
        if (!date) return <td key={'blank-' + column} />;
        const items = mode === 'events' ? dayEvents(date) : dayBookings(date);
        const count = mode === 'events' ? dayEvents(date).filter(available).length : items.length;
        // A company may inspect an unavailable published session; only the request action is disabled.
        const unavailable = mode === 'events' && !admin && !items.length;
        const past = date < today;
        const states = Array.from(new Set((mode === 'events' ? dayEvents(date) : dayBookings(date).map(booking => booking.event)).map(event => presentation(event).state)));
        const label = !ready ? 'Loading' : mode === 'bookings' ? `${count} booking${count === 1 ? '' : 's'}` : past ? 'Past date' : count ? `${count} available` : items.length ? 'Unavailable' : admin ? 'No events scheduled' : 'Unavailable';
        // Exactly one fixed-height control per cell. Details belong in the agenda,
        // so a busy date cannot stretch its entire week or duplicate booking links.
        return <td key={date}><button type="button" className={`${css.day} ${items.length ? css.hasSessions : ''} ${past ? css.past : ''}`} data-calendar-date={date} onKeyDown={event => moveDayFocus(event,date)} aria-label={`${calendarLabel(date)}: ${label}${mode === 'events' && items.length ? '. ' + Array.from(new Set(dayEvents(date).map(event => presentation(event).label))).join(', ') : ''}`} aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined} disabled={disabled || !ready || unavailable} onClick={() => setSelection({ month, date })}><strong>{Number(date.slice(-2))}</strong><span className={css.daySummary} aria-hidden="true">{items.length ? `${items.length} ${mode === 'bookings' ? items.length === 1 ? 'booking' : 'bookings' : items.length === 1 ? 'session' : 'sessions'}` : ''}</span>{Boolean(items.length) && <span className={css.dayCount} aria-hidden="true">{items.length}</span>}<span className={css.dayMarkers} aria-hidden="true">{states.map(state => <span key={state} className={css.stateDot} data-state={state} />)}</span></button></td>;
      })}</tr>)}</tbody></table><p className={css.hint}>{mode === 'events' ? 'Each session is exclusive to one company. Requests reserve nothing; admin acceptance reserves the session.' : 'Select a date to review its group bookings.'}</p>{ready && !data.rows.length && <p className={css.hint} role="status">No matching {mode === 'events' ? 'events' : 'bookings'} this month. Try another month or adjust the filters.</p>}</div>
      <section className={css.agenda} aria-label="Selected date"><h3>{selected ? calendarLabel(selected) : 'Choose a date'}</h3>
        {!selected && <p>Select a date to view its {mode === 'events' ? 'sessions' : 'bookings'}.</p>}
        {selected && !ready && <p>{error ? 'Details could not be loaded. Use Retry to try again.' : 'Loading the latest details…'}</p>}
        {selected && ready && <>
          {mode === 'events' && <>{selectedEvents.map(event => <article key={event.id} className={css.item} data-state={presentation(event).state}><h3>{event.title}</h3><p>{calendarTime(event.starts_at)}–{calendarTime(event.ends_at)} · {event.location}</p><p>{event.description}</p><p>Exclusive session · maximum {event.max_group_size} people</p><span className={css.status} data-state={presentation(event).state}>{presentation(event).label}</span><div className={ui.actions}>
            <button type="button" className={admin ? styles.secondaryButton : styles.primaryButton} disabled={disabled || (admin ? event.state === 'Cancelled' || Date.parse(event.starts_at) <= now : !requestsOpen || !available(event))} onClick={() => onEvent?.(event)}>{admin ? 'Edit session' : 'Request booking'}</button>
            {admin && corporateChangesEnabled && event.state !== 'Cancelled' && Date.parse(event.ends_at) > now && <button type="button" className={styles.dangerButton} disabled={disabled} onClick={() => onCancelEvent?.(event)}>Cancel event</button>}
          </div></article>)}{!selectedEvents.length && <p>{filters.query.trim() ? 'No events match your search on this date.' : filters.from && selected < filters.from || filters.to && selected > filters.to ? 'This date is outside the selected date range.' : 'No events scheduled.'}</p>}{admin && onCreateDate && <button type="button" className={styles.primaryButton} disabled={disabled || selected < calendarDate(now)} onClick={() => onCreateDate(selected)}>Create event on this date</button>}</>}
          {mode === 'bookings' && <>{selectedBookings.sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at)).map(booking => <article key={booking.id} className={css.item} data-state={presentation(booking.event).state}><h3>{booking.contact_snapshot.company_name}</h3><p>{booking.event.title}</p><p>{calendarTime(booking.event.starts_at)}–{calendarTime(booking.event.ends_at)} · {booking.group_size} people</p><span className={ui.badge}>{booking.status}</span><span className={css.status} data-state={presentation(booking.event).state}>{presentation(booking.event).label}</span>{corporateBookingOverdue(booking, now) && <p>Payment overdue · session remains reserved</p>}{booking.pending_change && <p>{booking.pending_change.kind === 'Cancellation' ? 'Cancellation' : 'Change'} requested</p>}<div><button type="button" className={styles.secondaryButton} disabled={disabled} onClick={() => onBooking?.(booking.id)}>{admin ? 'Review booking' : 'Details'}</button></div></article>)}{!selectedBookings.length && <p>No matching bookings on this date.</p>}</>}
        </>}
      </section>
    </div>
  </div>;
}
