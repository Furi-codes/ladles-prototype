"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AttendanceRecord, Booking, CorporateBooking, Event, EventSlot } from "@/lib/types";
import styles from "../admin.module.css";
import visual from "./analytics.module.css";
import type { PerformanceRow } from "@/lib/reporting";
import HorizontalScroller from "./HorizontalScroller";
import { EVENT_TIME_OPTIONS } from "@/lib/event-time-options";

type AnalyticsData = {
  events: Event[];
  slots: EventSlot[];
  bookings: Booking[];
  attendance: AttendanceRecord[];
  corporate: CorporateBooking[];
};

function shortHour(time: string) {
  return time.slice(0, 5);
}

export function AnalyticsOverview({ data }: { data: AnalyticsData }) {
  const attendanceByBooking = new Set(data.attendance.filter((record) => record.clocked_in_at).map((record) => record.booking_id));
  const byCategory = new Map<string, { attendance: number; hours: number; events: number }>();

  for (const event of data.events.filter((item) => item.status !== "Cancelled")) {
    const category = event.category || "Other";
    const current = byCategory.get(category) ?? { attendance: 0, hours: 0, events: 0 };
    const eventBookings = data.bookings.filter((booking) => booking.event_id === event.id);
    const bookingIds = new Set(eventBookings.map((booking) => booking.id));
    const eventAttendance = data.attendance.filter((record) => bookingIds.has(record.booking_id));
    const corporate = data.corporate.filter((booking) => booking.event_id === event.id && booking.status === "Completed");
    current.events += 1;
    current.attendance += eventBookings.filter((booking) => attendanceByBooking.has(booking.id)).length + corporate.reduce((total, booking) => total + (booking.attendance_count ?? 0), 0);
    current.hours += eventAttendance.reduce((total, record) => total + (record.worked_minutes ?? 0), 0) / 60 + corporate.reduce((total, booking) => total + Number(booking.volunteer_hours ?? 0), 0);
    byCategory.set(category, current);
  }

  const categories = [...byCategory.entries()].sort((first, second) => second[1].hours - first[1].hours);
  const maximum = Math.max(1, ...categories.map(([, value]) => value.hours));

  return <section className={`${styles.card} ${visual.categoryCard}`} aria-labelledby="category-comparison">
      <div className={styles.cardHeader}><div><span className={visual.eyebrow}>Programme breakdown</span><h2 id="category-comparison" className={styles.cardTitle}>Hours by programme</h2><p className={styles.cardHint}>Individual hours + recorded corporate hours.</p></div></div>
      <div className={styles.analyticsBody}>
        {categories.length ? <div className={styles.categoryList}>{categories.map(([category, value]) => <div className={visual.categoryRow} key={category}>
          <div className={visual.categoryLabel}><strong>{category}</strong><span>{value.events} event{value.events === 1 ? "" : "s"} · {value.attendance} attendance instances</span></div>
          <div className={visual.categoryBar} aria-label={`${category}: ${value.hours.toFixed(1)} hours`}><span style={{ width: `${(value.hours / maximum) * 100}%` }} /></div>
          <strong className={visual.categoryValue}>{value.hours.toFixed(1)}h</strong>
        </div>)}</div> : <p className={styles.empty}>No category data matches these filters.</p>}
      </div>
    </section>;
}

export function AttendanceHeatmap({ data }: { data: AnalyticsData }) {
  const heatmapPanel = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === heatmapPanel.current);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement === heatmapPanel.current) {
      await document.exitFullscreen();
      return;
    }
    await heatmapPanel.current?.requestFullscreen();
  }

  const events = [...data.events].sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const slotById = new Map(data.slots.map((slot) => [slot.id, slot]));
  const checkedIn = new Set(data.attendance.filter((record) => record.clocked_in_at).map((record) => record.booking_id));
  const times = [...new Set([...EVENT_TIME_OPTIONS, ...data.slots.map((slot) => shortHour(slot.start_time))])].sort();
  const values = new Map<string, number>();
  let unplaced = 0;
  const add = (eventId: number, slotId: number | null | undefined, amount: number) => {
    const event = eventById.get(eventId);
    const slot = slotId ? slotById.get(slotId) : undefined;
    if (!event || event.status === "Cancelled") return;
    if (!slot) { unplaced += amount; return; }
    const key = `${event.id}-${shortHour(slot.start_time)}`;
    values.set(key, (values.get(key) ?? 0) + amount);
  };

  for (const booking of data.bookings) if (checkedIn.has(booking.id)) add(booking.event_id, booking.event_slot_id, 1);
  for (const booking of data.corporate) if (booking.status === "Completed") add(booking.event_id, booking.event_slot_id, booking.attendance_count ?? 0);
  const maximum = Math.max(1, ...values.values());
  const cellStyle = (count: number): CSSProperties => ({ backgroundColor: count / maximum > .55 ? '#b91c32' : count ? `color-mix(in srgb, var(--portal-accent) ${Math.round(10 + count / maximum * 35)}%, var(--portal-surface))` : 'var(--portal-bg)', color: count / maximum > .55 ? '#fff' : 'var(--portal-ink)' });

  return <section ref={heatmapPanel} className={`${styles.card} ${visual.heatmapCard}`} aria-labelledby="attendance-heatmap">
    <div className={styles.cardHeader}><div><h2 id="attendance-heatmap" className={styles.cardTitle}>Attendance heatmap</h2><p className={styles.cardHint}>Recorded attendance by event and shift start time. Each column identifies one selected event.</p></div><button type="button" className={styles.secondaryButton} aria-pressed={isFullscreen} onClick={() => void toggleFullscreen()}>{isFullscreen ? "Exit full screen" : "Expand heatmap"}</button></div>
    <HorizontalScroller label="Attendance heatmap table">
      {times.length && events.length ? <table className={visual.eventHeatmap}><thead><tr><th scope="col">Shift time</th>{events.map(event => <th key={event.id} scope="col"><span className={visual.eventHeatmapDate}>{new Date(`${event.date}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span><span className={visual.eventHeatmapName} title={event.title}>{event.title}</span></th>)}</tr></thead><tbody>{times.map(time => <tr key={time}><th scope="row">{time}</th>{events.map(event => { const count = values.get(`${event.id}-${time}`) ?? 0; return <td key={event.id}><span className={visual.eventHeatmapCell} style={cellStyle(count)} title={`${event.title} on ${event.date}, ${time}: ${count} recorded attendee${count === 1 ? "" : "s"}`}>{count}</span></td>; })}</tr>)}</tbody></table> : <p className={styles.empty}>No event slots match these filters.</p>}
    </HorizontalScroller>
    <p className={styles.analyticsNote}>Lighter = fewer attendees · Darker = more attendees. Values count attendance instances, not unique people. Drag the red slider beneath the table to view additional events. {unplaced > 0 && `${unplaced} attendance instances have no linked shift and cannot be placed in this grid.`}</p>
  </section>;
}

export function EventPerformanceChart({ rows }: { rows: PerformanceRow[] }) {
  const recent = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const maximum = Math.max(1, ...recent.flatMap(row => [row.bookings, row.attendance]));
  return <section className={styles.card} aria-labelledby="event-comparison">
    <div className={styles.cardHeader}><div><h2 id="event-comparison" className={styles.cardTitle}>Bookings and attendance</h2><p className={styles.cardHint}>Up to six most recent selected events. Reserved places in grey; recorded attendance in red.</p></div></div>
    <div className={visual.insights}>{recent.map(row => <div key={row.id} className={visual.comparison}>
      <div className={visual.categoryLabel}><strong>{row.event}</strong><span>{row.date} · {row.attendance} attended / {row.bookings} reserved</span></div>
      <div className={visual.comparisonBars} role="img" aria-label={`${row.event}: ${row.bookings} reserved places; ${row.attendance} attendance instances`}><span style={{ width: `${row.bookings / maximum * 100}%` }} /><span style={{ width: `${row.attendance / maximum * 100}%` }} /></div>
    </div>)}{!recent.length && <p>No events match this selection.</p>}</div>
    <p className={styles.analyticsNote}>Attendance may still be incomplete for upcoming or ongoing events. Corporate places are not unique employees.</p>
  </section>;
}
