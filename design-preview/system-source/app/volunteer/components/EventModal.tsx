"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ui from "./experience.module.css";
import type { Booking, Event, EventSlot, Profile } from "@/lib/types";
import { hasSlotEnded } from "@/lib/date-utils";
import styles from "../volunteer.module.css";
const formatTime = (value: string) => value.slice(0, 5);
export default function EventModal({ event, eventSlots, bookings, profile, onClose, onBook }: { event: Event | null; eventSlots: EventSlot[]; bookings: Booking[]; profile: Profile | null; onClose: () => void; onBook: (slot: EventSlot) => Promise<string | null> }) {
  const [selectedSlotId, setSelectedSlotId] = useState(""); const [message, setMessage] = useState<string | null>(null); const [isSubmitting, setIsSubmitting] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const submittingRef = useRef(false);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const eventId = event?.id;
  useEffect(() => {
    if (!eventId) return;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submittingRef.current) closeRef.current();
      if (e.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled)');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [eventId]);
  if (!event) return null;
  const existingBooking = bookings.find((booking) => booking.event_id === event.id && booking.user_id === profile?.id);
  const slotsRemaining = (slot: EventSlot) => slot.remaining;
  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submittingRef.current) return;
    const selectedSlot = eventSlots.find(slot => slot.id === Number(selectedSlotId) && slot.event_id === event?.id);
    if (!event || event.status === 'Cancelled' || existingBooking || !selectedSlot || hasSlotEnded(event, selectedSlot) || (selectedSlot.remaining !== undefined && selectedSlot.remaining <= 0)) {
      setMessage('This shift is no longer available. Please choose another time range.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const error = await onBook(selectedSlot);
      if (error) setMessage(error);
      else closeRef.current();
    } catch {
      setMessage('We could not confirm your booking. Refresh your bookings before retrying.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }
  return <div className={styles.backdrop} role="presentation" onMouseDown={(clickEvent) => { if (clickEvent.target === clickEvent.currentTarget) onClose(); }}><section ref={dialog} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="event-modal-title"><div className={styles.modalHeader}><div><h2 id="event-modal-title" className={styles.cardTitle}>{event.title}</h2><p className={styles.cardHint}>{event.date} · {event.location}</p>{event.location_url && <a className={styles.mapLink} href={event.location_url} target="_blank" rel="noreferrer">View location on map</a>}</div><button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close event">×</button></div>{event.description && <p className={styles.description}>{event.description}</p>}{existingBooking ? <><div className={styles.messageSuccess}>Your booking ({existingBooking.status}): <strong>{existingBooking.selected_slot}</strong></div><div className={ui.body}><p>Scan the event QR code when you arrive and again when you finish. Verified hours are added after clock-out.</p></div><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Close</button><Link href="/volunteer/attendance" className={styles.primaryButton}>Open attendance scanner</Link></div></> : eventSlots.length === 0 ? <><div className={styles.messageError}>Booking is not available yet because this event has no published time ranges.</div><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Close</button></div></> : <form onSubmit={submit}><div className={styles.field}><label className={styles.fieldLabel} htmlFor="time-range">Choose a time range</label><select id="time-range" className={styles.select} required value={selectedSlotId} onChange={(changeEvent) => setSelectedSlotId(changeEvent.target.value)}><option value="">Select a time range</option>{eventSlots.map((slot) => { const remaining = slotsRemaining(slot); const ended = hasSlotEnded(event, slot); return <option key={slot.id} value={slot.id} disabled={ended || remaining === 0}>{formatTime(slot.start_time)}-{formatTime(slot.end_time)} · {ended ? "Shift ended" : remaining === undefined ? "Availability checked when booking" : `${remaining} place${remaining === 1 ? "" : "s"} available`}</option>; })}</select></div><div className={styles.signedInAs}>Booking as <strong>{profile?.full_name || profile?.email || "Volunteer"}</strong></div>{message && <div className={styles.messageError} role="alert">{message}</div>}<div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={isSubmitting}>{isSubmitting ? "Booking..." : "Book this shift"}</button></div></form>}</section></div>;
}
