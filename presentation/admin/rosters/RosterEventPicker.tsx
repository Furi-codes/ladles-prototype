"use client";

/**
 * Lets admin choose a roster from a searchable, scrollable list of events.
 * Moving the keyboard highlight does not change the roster until the user selects an event.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { Event } from '@/business/shared/types';
import styles from '@/presentation/admin/rosters/RosterEventPicker.module.css';

type RosterEvent = Pick<Event, 'id' | 'title' | 'date' | 'location'>;

/** Searching only narrows the choices; selecting a result changes the roster. */
export default function RosterEventPicker({ events, value, onChange }: {
  events: RosterEvent[]; value: string; onChange: (id: string) => void;
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [search, setSearch] = useState(''), [active, setActive] = useState('');
  const selected = events.find(event => String(event.id) === value);
  const query = search.trim().toLowerCase();
  const matches = events.filter(event => `${event.title} ${event.date} ${event.location}`.toLowerCase().includes(query));
  const activeId = matches.some(event => String(event.id) === active) ? active
    : matches.some(event => String(event.id) === value) ? value : String(matches[0]?.id ?? '');
  const optionId = (eventId: string) => `${id}-event-${eventId}`;

  useEffect(() => {
    if (open && activeId && typeof document !== 'undefined') document.getElementById(`${id}-event-${activeId}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeId, id]);
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  /**
   * Commit the chosen event and close the picker. Highlighting an option alone does not change
   * the roster.
   */
  function select(eventId: string) {
    onChange(eventId); setOpen(false); setSearch('');
  }
  /**
   * Scroll the keyboard-highlighted option into the picker viewport.
   */
  function reveal() { setSearch(''); setActive(value); setOpen(true); }
  return <div ref={root} className={styles.picker} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>Choose event</label>
    <div className={styles.control}>
      <input ref={input} id={id} type="search" role="combobox" aria-autocomplete="list" autoComplete="off"
        aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={open && activeId ? optionId(activeId) : undefined}
        disabled={!events.length} placeholder={events.length ? 'Search events or locations…' : 'No matching events'}
        value={open ? search : selected?.title || ''} onFocus={reveal}
        onChange={event => { setSearch(event.target.value); setActive(''); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) { reveal(); return; }
            if (!matches.length) return;
            const index = matches.findIndex(item => String(item.id) === activeId);
            const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
            setActive(String(matches[next].id));
          } else if (event.key === 'Enter' && open) {
            event.preventDefault(); if (activeId) select(activeId);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false); setSearch('');
          }
        }} />
      <button type="button" disabled={!events.length} tabIndex={-1} aria-label={open ? 'Close event choices' : 'Open event choices'}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { input.current?.focus(); reveal(); } }}>
        <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7 5 5 5-5" /></svg>
      </button>
    </div>
    {open && <div className={styles.popup}>
      <p className={styles.count} role="status">{matches.length} {matches.length === 1 ? 'event' : 'events'}</p>
      <ul id={`${id}-results`} role="listbox" aria-label="Roster events" className={styles.results}>
        {matches.map(event => <li key={event.id} id={optionId(String(event.id))} role="option" aria-selected={String(event.id) === value}
          className={activeId === String(event.id) ? styles.active : undefined}
          onPointerDown={event => event.preventDefault()} onClick={() => select(String(event.id))}>
          <span className={styles.eventHeading}><strong>{event.title}</strong><time dateTime={event.date}>{event.date}</time></span>
          <span className={styles.location}>{event.location || 'Location not provided'}</span>
        </li>)}
      </ul>
      {!matches.length && <p className={styles.empty}>No matching events. Try another name, date or location.</p>}
    </div>}
  </div>;
}
