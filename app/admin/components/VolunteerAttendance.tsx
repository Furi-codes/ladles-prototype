"use client";

import LiveAttendanceTime from "@/app/components/LiveAttendanceTime";
import { formatAttendanceTime, formatWorkedTime, getEventSlotEndAt } from "@/lib/attendance-utils";
import { hasEventFinished } from "@/lib/date-utils";
import type { AttendanceRecord, Booking, Event, EventSlot } from "@/lib/types";
import { useMemo, useState } from "react";
import styles from "../admin.module.css";

type RosterView = "current" | "past" | "cancelled";

type VolunteerAttendanceProps = {
  events: Event[];
  eventSlots: EventSlot[];
  bookings: Booking[];
  attendanceRecords: AttendanceRecord[];
};

export default function VolunteerAttendance({ events, eventSlots, bookings, attendanceRecords }: VolunteerAttendanceProps) {
  const [view, setView] = useState<RosterView>("current");
  const [selectedEventId, setSelectedEventId] = useState("");

  const currentEvents = useMemo(() => events
    .filter((event) => event.status !== "Cancelled" && !hasEventFinished(event, eventSlots))
    .sort((first, second) => first.date.localeCompare(second.date)), [events, eventSlots]);
  const pastEvents = useMemo(() => events
    .filter((event) => event.status !== "Cancelled" && hasEventFinished(event, eventSlots))
    .sort((first, second) => second.date.localeCompare(first.date)), [events, eventSlots]);
  const cancelledEvents = useMemo(() => events
    .filter((event) => event.status === "Cancelled")
    .sort((first, second) => (second.cancelled_at ?? "").localeCompare(first.cancelled_at ?? "")), [events]);
  const filteredEvents = view === "current" ? currentEvents : view === "past" ? pastEvents : cancelledEvents;

  const effectiveSelectedEventId = filteredEvents.some((event) => event.id.toString() === selectedEventId)
    ? selectedEventId
    : filteredEvents[0]?.id.toString() ?? "";
  const selectedEvent = filteredEvents.find((event) => event.id.toString() === effectiveSelectedEventId);
  const currentRoster = bookings.filter((booking) => booking.event_id.toString() === effectiveSelectedEventId);
  const checkedIn = currentRoster.filter((booking) => attendanceRecords.some((record) => record.booking_id === booking.id && record.clocked_in_at)).length;
  const completed = currentRoster.filter((booking) => booking.status === "Completed").length;

  function chooseView(nextView: RosterView) {
    setView(nextView);
    setSelectedEventId("");
  }

  return <section className={styles.card} aria-labelledby="roster-title">
    <div className={styles.rosterIntro}>
      <div>
        <h2 id="roster-title" className={styles.rosterTitle}>Manage volunteer rosters</h2>
        <p className={styles.cardHint}>Review event participants, live QR attendance, and recorded hours.</p>
      </div>
      <div className={styles.rosterControls}>
        <div className={styles.filterGroup} role="tablist" aria-label="Roster event filter">
          <button type="button" role="tab" aria-selected={view === "current"} className={`${styles.filterButton} ${view === "current" ? styles.filterButtonActive : ""}`} onClick={() => chooseView("current")}>Upcoming & current ({currentEvents.length})</button>
          <button type="button" role="tab" aria-selected={view === "past"} className={`${styles.filterButton} ${view === "past" ? styles.filterButtonActive : ""}`} onClick={() => chooseView("past")}>Past events ({pastEvents.length})</button>
          <button type="button" role="tab" aria-selected={view === "cancelled"} className={`${styles.filterButton} ${view === "cancelled" ? styles.filterButtonActive : ""}`} onClick={() => chooseView("cancelled")}>Cancelled events ({cancelledEvents.length})</button>
        </div>
        <label className={styles.rosterSelector}>
          <span>{view === "current" ? "Choose current event" : view === "past" ? "Choose past event" : "Choose cancelled event"}</span>
          <select className={styles.select} value={effectiveSelectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} disabled={filteredEvents.length === 0}>
            {filteredEvents.length === 0 ? <option value="">No events in this view</option> : filteredEvents.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.date}</option>)}
          </select>
        </label>
      </div>
    </div>

    {!selectedEvent ? <div className={styles.empty}>{view === "current" ? "No upcoming or current event rosters yet." : view === "past" ? "No past event rosters yet." : "No cancelled event rosters yet."}</div> : <>
      <div className={styles.rosterSummary}>
        <div><strong>{currentRoster.length}</strong><span>Registered</span></div>
        <div><strong>{checkedIn}</strong><span>Clocked in</span></div>
        <div><strong>{completed}</strong><span>Completed</span></div>
        <p><strong>{selectedEvent.title}</strong><br />{selectedEvent.date} · {selectedEvent.location}</p>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>{["Volunteer", "Time range", "Status", "Clock in", "Clock out", "Hours"].map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {currentRoster.map((booking) => {
              const attendance = attendanceRecords.find((record) => record.booking_id === booking.id);
              const slot = eventSlots.find((item) => item.id === booking.event_slot_id);
              const endsAt = slot ? getEventSlotEndAt(selectedEvent, slot) : undefined;
              const isLive = Boolean(attendance?.clocked_in_at && !attendance?.clocked_out_at);
              const statusClass = booking.status === "Present" ? styles.statusPresent : booking.status === "Completed" ? styles.statusCompleted : booking.status === "No show" ? styles.statusCancelled : styles.statusConfirmed;

              return <tr key={booking.id}>
                <td>{booking.volunteer_name}<br /><span className={styles.rosterEmail}>{booking.volunteer_email}</span></td>
                <td>{booking.selected_slot}</td>
                <td><span className={`${styles.status} ${statusClass}`}>{booking.status}</span></td>
                <td>{formatAttendanceTime(attendance?.clocked_in_at ?? null)}</td>
                <td>{formatAttendanceTime(attendance?.clocked_out_at ?? null)}</td>
                <td>{attendance ? isLive ? <span className={styles.liveAttendance}><LiveAttendanceTime attendance={attendance} endsAt={endsAt} prefix="Live" /></span> : formatWorkedTime(attendance.worked_minutes) : "—"}</td>
              </tr>;
            })}
            {currentRoster.length === 0 && <tr><td colSpan={6}><div className={styles.empty}>No volunteers have registered for this event.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>}
  </section>;
}
