import { getLocalDateString } from "@/lib/date-utils";
import type { Event } from "@/lib/types";
import styles from "../volunteer.module.css";

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00`));
}

export default function UpcomingEvents({ events, isLoading, isUserBookedForEvent, onSelect }: { events: Event[]; isLoading: boolean; isUserBookedForEvent: (eventId: number) => boolean; onSelect: (event: Event) => void }) {
  const upcomingEvents = events.filter((event) => event.date >= getLocalDateString()).sort((first, second) => first.date.localeCompare(second.date));
  return <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Upcoming events</h2><p className={styles.cardHint}>Choose an event to view its shift ranges and reserve your place.</p></div><span className={styles.eventCount}>{upcomingEvents.length}</span></div>{isLoading ? <div className={styles.emptySmall}>Loading upcoming events...</div> : upcomingEvents.length === 0 ? <div className={styles.empty}>There are no upcoming events right now.<br />Please check back soon.</div> : <div className={styles.upcomingList}>{upcomingEvents.map((event) => { const booked = isUserBookedForEvent(event.id); return <article className={styles.upcomingEvent} key={event.id}><div className={styles.eventDate}><span className={styles.eventDateDay}>{new Date(`${event.date}T00:00:00`).getUTCDate()}</span><span className={styles.eventDateMonth}>{new Intl.DateTimeFormat("en-ZA", { month: "short", timeZone: "UTC" }).format(new Date(`${event.date}T00:00:00`))}</span></div><div className={styles.upcomingDetails}><h3 className={styles.upcomingTitle}>{event.title}</h3><p className={styles.upcomingMeta}>{formatEventDate(event.date)} · {event.location}</p><p className={styles.upcomingSlots}>{event.time_slots}</p></div><div className={styles.eventAction}><span className={booked ? styles.bookedStatus : styles.availableStatus}>{booked ? "Your shift" : "Available"}</span><button type="button" className={booked ? styles.secondaryButton : styles.primaryButton} onClick={() => onSelect(event)}>{booked ? "View booking" : "View event"}</button></div></article>; })}</div>}</section>;
}
