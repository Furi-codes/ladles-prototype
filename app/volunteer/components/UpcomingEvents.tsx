"use client";
import { useState } from 'react';
import { hasEventFinished, hasSlotEnded } from '@/lib/date-utils';
import type { Event, EventSlot } from '@/lib/types';
import styles from '../volunteer.module.css';
import ui from './experience.module.css';

export default function UpcomingEvents({ events, eventSlots, isLoading, isUserBookedForEvent, onSelect }: { events: Event[]; eventSlots: EventSlot[]; isLoading: boolean; isUserBookedForEvent: (eventId: number) => boolean; onSelect: (event: Event) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const upcoming = events.filter(e => e.status !== 'Cancelled' && !hasEventFinished(e, eventSlots)).sort((a,b) => a.date.localeCompare(b.date));
  const categories = [...new Set(upcoming.map(e => e.category || 'Other'))].sort();
  const matches = upcoming.filter(e => (!category || (e.category || 'Other') === category) && (e.title + ' ' + e.location).toLowerCase().includes(query.trim().toLowerCase()));
  return <section id="opportunities" className={styles.card}>
    <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Find your next opportunity</h2><p className={styles.cardHint}>Choose an event, explore its shifts and reserve your place.</p></div><span className={styles.eventCount}>{matches.length}</span></div>
    <div className={ui.filters}><label className={ui.filterLabel}>Search events or locations<input className={styles.input} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find an opportunity…" /></label><label className={ui.filterLabel}>Programme<select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}><option value="">All programmes</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div>
    {isLoading ? <p className={styles.emptySmall}>Loading opportunities…</p> : !matches.length ? <div className={styles.empty}>{upcoming.length ? <><p>No opportunities match your filters.</p><button className={styles.secondaryButton} onClick={() => { setQuery(''); setCategory(''); }}>Clear filters</button></> : 'There are no upcoming events right now. Please check back soon.'}</div> : <div className={styles.upcomingList}>{matches.map(event => {
      const booked = isUserBookedForEvent(event.id);
      const slots = eventSlots.filter(s => s.event_id === event.id && !hasSlotEnded(event, s));
      const known = slots.length > 0 && slots.every(s => s.remaining !== undefined);
      const remaining = slots.reduce((sum,s) => sum + (s.remaining ?? 0), 0);
      const date = new Date(event.date + 'T00:00:00Z');
      return <article className={styles.upcomingEvent} key={event.id}><div className={styles.eventDate}><span className={styles.eventDateDay}>{date.getUTCDate()}</span><span className={styles.eventDateMonth}>{new Intl.DateTimeFormat('en-ZA', {month:'short', timeZone:'UTC'}).format(date)}</span></div><div className={styles.upcomingDetails}><span className={ui.badge}>{event.category || 'Other'}</span><h3 className={styles.upcomingTitle}>{event.title}</h3><p className={styles.upcomingMeta}>{event.location} · {event.date}</p><p className={styles.upcomingSlots}>{slots.length ? slots.length + ' shifts · ' + slots.map(s => s.start_time.slice(0,5) + '–' + s.end_time.slice(0,5)).join(' / ') : 'No open shifts'}</p></div><div className={styles.eventAction}><span className={booked ? styles.bookedStatus : styles.availableStatus}>{booked ? 'Place reserved' : !slots.length ? 'Not open' : known ? remaining ? remaining + ' places left' : 'Fully booked' : 'Check availability'}</span><button className={booked ? styles.secondaryButton : styles.primaryButton} onClick={() => onSelect(event)}>{booked ? 'View booking' : 'View shifts'}</button></div></article>;
    })}</div>}
  </section>;
}
