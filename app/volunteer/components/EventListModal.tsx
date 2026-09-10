import type { Event } from "@/lib/types";
import styles from "../volunteer.module.css";

function formatDate(date: string) { return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00`)); }

export default function EventListModal({ events, onClose, onEventClick, isUserBookedForEvent }: { events: Event[]; onClose: () => void; onEventClick: (event: Event) => void; isUserBookedForEvent: (eventId: number) => boolean }) {
  if (events.length === 0) return null;
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`${styles.modal} ${styles.modalWide}`} role="dialog" aria-modal="true" aria-labelledby="events-on-day-title"><div className={styles.modalHeader}><div><h2 id="events-on-day-title" className={styles.cardTitle}>Events on {formatDate(events[0].date)}</h2><p className={styles.cardHint}>Choose an event to view its available shift ranges.</p></div><button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close event list">×</button></div><div className={styles.eventOptionList}>{events.map((event) => { const booked = isUserBookedForEvent(event.id); return <button type="button" key={event.id} className={styles.eventOption} disabled={booked} onClick={() => onEventClick(event)}><span className={styles.eventOptionTitle}>{event.title}{booked ? " — already booked" : ""}</span><span className={styles.eventOptionMeta}>{event.location} · {event.time_slots}</span></button>; })}</div></section></div>;
}
