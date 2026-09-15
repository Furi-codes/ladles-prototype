"use client";

import type { Booking, Event, EventSlot, Volunteer } from "../../../lib/types";
import { hasEventFinished } from "@/lib/date-utils";
import styles from "../admin.module.css";
import Icon from "./Icon";

function StatusBadge({ status }: { status: Booking["status"] }) {
  const className = status === "Present" ? styles.statusPresent : status === "Completed" ? styles.statusCompleted : status === "No show" ? styles.statusCancelled : styles.statusConfirmed;
  return <span className={`${styles.status} ${className}`}>{status}</span>;
}

export default function Dashboard({ bookings, events, eventSlots, volunteers, isLoading, hasError }: { bookings: Booking[]; events: Event[]; eventSlots: EventSlot[]; volunteers: Volunteer[]; isLoading: boolean; hasError: boolean }) {
  const upcomingEvents = events.filter((event) => event.status !== "Cancelled" && !hasEventFinished(event, eventSlots)).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingEventIds = new Set(upcomingEvents.map((event) => event.id));
  const upcomingBookings = bookings.filter((booking) => upcomingEventIds.has(booking.event_id));
  const getEvent = (id: number) => events.find((event) => event.id === id);
  const stats = [
    { label: "Upcoming bookings", value: upcomingBookings.length, note: "Across upcoming and current events", icon: "users" as const },
    { label: "Upcoming events", value: upcomingEvents.length, note: "From today onward", icon: "calendar" as const },
    { label: "Registered volunteers", value: volunteers.length, note: "Active profiles", icon: "users" as const },
    { label: "System status", value: isLoading ? "Syncing" : hasError ? "Error" : "Ready", note: hasError ? "Check data connection" : "Data is up to date", icon: "activity" as const },
  ];

  return <>
    <section className={styles.stats} aria-label="Summary statistics">{stats.map((stat) => <div key={stat.label} className={`${styles.card} ${styles.stat}`}><div className={styles.statTop}><span className={styles.statLabel}>{stat.label}</span><span className={styles.statIcon}><Icon name={stat.icon} size={16} /></span></div><div className={styles.statValue}>{stat.value}</div><div className={styles.statNote}>{stat.note}</div></div>)}</section>
    <div className={styles.dashboardGrid}>
      <section className={styles.card} aria-labelledby="recent-bookings"><div className={styles.cardHeader}><div><h2 id="recent-bookings" className={`${styles.cardTitle} ${styles.dashboardCardTitle}`}>Recent upcoming bookings</h2><p className={styles.cardHint}>The latest reservations for events that have not ended</p></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Volunteer", "Event", "Time", "Status"].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{upcomingBookings.slice(0, 5).map((booking) => <tr key={booking.id}><td>{booking.volunteer_name}</td><td>{getEvent(booking.event_id)?.title ?? "Unknown event"}</td><td>{booking.selected_slot}</td><td><StatusBadge status={booking.status} /></td></tr>)}{upcomingBookings.length === 0 && <tr><td colSpan={4}><div className={styles.empty}>No bookings exist for upcoming events.</div></td></tr>}</tbody></table></div></section>
      <section className={styles.card} aria-labelledby="upcoming-events"><div className={styles.cardHeader}><div><h2 id="upcoming-events" className={`${styles.cardTitle} ${styles.dashboardCardTitle}`}>Upcoming events</h2><p className={styles.cardHint}>Next events on the calendar</p></div></div><div className={styles.activityList}>{upcomingEvents.slice(0, 5).map((event) => { const count = bookings.filter((booking) => booking.event_id === event.id).length; return <div className={styles.activityRow} key={event.id}><div><div className={styles.activityName}>{event.title}</div><div className={styles.activityMeta}>{event.date} · {event.location}</div></div><div className={styles.activityCount}>{count} / {event.total_slots}<br /><span style={{ color: "#8a94a1", fontWeight: 500 }}>booked</span></div></div>; })}{upcomingEvents.length === 0 && <div className={styles.empty}>No upcoming events.</div>}</div></section>
    </div>
  </>;
}
