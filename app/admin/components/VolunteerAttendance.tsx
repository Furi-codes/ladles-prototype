"use client";

import LiveAttendanceTime from "@/app/components/LiveAttendanceTime";
import { formatAttendanceTime, formatWorkedTime, getEventSlotEndAt } from "@/lib/attendance-utils";
import type { AttendanceRecord, Booking, Event, EventSlot } from "@/lib/types";
import { useMemo, useState } from "react";
import styles from "../admin.module.css";

export default function VolunteerAttendance({ events, eventSlots, bookings, attendanceRecords }: { events: Event[]; eventSlots: EventSlot[]; bookings: Booking[]; attendanceRecords: AttendanceRecord[] }) {
  const rosterEvents = useMemo(() => events.filter((event) => event.status !== "Cancelled").sort((first, second) => second.date.localeCompare(first.date)), [events]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const selectedEvent = rosterEvents.find((event) => event.id.toString() === selectedEventId);
  const currentRoster = bookings.filter((booking) => booking.event_id.toString() === selectedEventId);
  const checkedIn = currentRoster.filter((booking) => attendanceRecords.some((record) => record.booking_id === booking.id && record.clocked_in_at)).length;
  const completed = currentRoster.filter((booking) => booking.status === "Completed").length;

  return <section className={styles.card} aria-labelledby="attendance-title">
    <div className={styles.rosterIntro}>
      <div><h2 id="attendance-title" className={styles.rosterTitle}>Event roster</h2><p className={styles.cardHint}>Choose an event to see its volunteers, QR attendance, and recorded hours.</p></div>
      <label className={styles.rosterSelector}><span>Choose event</span><select className={styles.select} value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}><option value="">Select an event roster</option>{rosterEvents.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.date}</option>)}</select></label>
    </div>
    {!selectedEvent ? <div className={styles.empty}>Select an event above to view its participants.</div> : <>
      <div className={styles.rosterSummary}><div><strong>{currentRoster.length}</strong><span>Registered</span></div><div><strong>{checkedIn}</strong><span>Clocked in</span></div><div><strong>{completed}</strong><span>Completed</span></div><p>{selectedEvent.date} · {selectedEvent.location}</p></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Volunteer", "Time range", "Status", "Clock in", "Clock out", "Hours"].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{currentRoster.map((booking) => { const attendance = attendanceRecords.find((record) => record.booking_id === booking.id); const slot = eventSlots.find((item) => item.id === booking.event_slot_id); const endsAt = slot ? getEventSlotEndAt(selectedEvent, slot) : undefined; const present = booking.status === "Present"; const completedBooking = booking.status === "Completed"; const noShow = booking.status === "No show"; const statusClass = present ? styles.statusPresent : completedBooking ? styles.statusCompleted : noShow ? styles.statusCancelled : styles.statusConfirmed; const isLive = Boolean(attendance?.clocked_in_at && !attendance?.clocked_out_at); return <tr key={booking.id}><td>{booking.volunteer_name}<br /><span className={styles.rosterEmail}>{booking.volunteer_email}</span></td><td>{booking.selected_slot}</td><td><span className={`${styles.status} ${statusClass}`}>{booking.status}</span></td><td>{formatAttendanceTime(attendance?.clocked_in_at ?? null)}</td><td>{formatAttendanceTime(attendance?.clocked_out_at ?? null)}</td><td>{attendance ? isLive ? <span className={styles.liveAttendance}><LiveAttendanceTime attendance={attendance} endsAt={endsAt} prefix="Live" /></span> : formatWorkedTime(attendance.worked_minutes) : "—"}</td></tr>; })}{currentRoster.length === 0 && <tr><td colSpan={6}><div className={styles.empty}>No volunteers have registered for this event.</div></td></tr>}</tbody></table></div>
    </>}
  </section>;
}
