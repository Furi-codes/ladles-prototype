"use client";

import LiveAttendanceTime from "@/app/components/LiveAttendanceTime";
import { formatAttendanceTime, formatWorkedTime } from "@/lib/attendance-utils";
import { updateBookingAttendance } from "@/lib/actions/admin";
import type { AttendanceRecord, Booking, Event } from "@/lib/types";
import { useState } from "react";
import styles from "../admin.module.css";

export default function VolunteerAttendance({ events, bookings, attendanceRecords }: { events: Event[]; bookings: Booking[]; attendanceRecords: AttendanceRecord[] }) {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendanceOverrides, setAttendanceOverrides] = useState<Partial<Record<number, "Present" | "Confirmed">>>({});
  const currentRoster = bookings
    .map((booking) => ({ ...booking, status: attendanceOverrides[booking.id] ?? booking.status }))
    .filter((booking) => booking.event_id.toString() === selectedEventId);

  async function handleToggleAttendance(bookingId: number, currentStatus: string) {
    const newStatus = currentStatus === "Present" ? "Confirmed" : "Present";
    setAttendanceOverrides((previous) => ({ ...previous, [bookingId]: newStatus }));
    try {
      const { error } = await updateBookingAttendance(bookingId, newStatus);
      if (error) throw error;
    } catch (error) {
      console.error("Failed to update attendance:", error);
      setAttendanceOverrides((previous) => {
        const next = { ...previous };
        delete next[bookingId];
        return next;
      });
    }
  }

  return <section className={styles.card} aria-labelledby="attendance-title">
    <div className={styles.cardHeader}>
      <div><h2 id="attendance-title" className={styles.cardTitle}>Attendance</h2><p className={styles.cardHint}>Select an event to monitor its roster, live clock-ins, and recorded hours.</p></div>
      <select className={styles.select} style={{ width: "min(280px, 48vw)" }} value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} aria-label="Select an event">
        <option value="">Select an event</option>
        {events.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.date}</option>)}
      </select>
    </div>
    {selectedEventId === "" ? <div className={styles.empty}>Select an event to view its volunteer roster.</div> : <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr>{["Volunteer", "Time range", "Status", "Clock in", "Clock out", "Hours", "Action"].map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {currentRoster.map((booking) => {
            const attendance = attendanceRecords.find((record) => record.booking_id === booking.id);
            const present = booking.status === "Present";
            const completed = booking.status === "Completed";
            const noShow = booking.status === "No show";
            const statusClass = present ? styles.statusPresent : completed ? styles.statusCompleted : noShow ? styles.statusCancelled : styles.statusConfirmed;
            const isLive = Boolean(attendance?.clocked_in_at && !attendance?.clocked_out_at);
            return <tr key={booking.id}>
              <td>{booking.volunteer_name}</td>
              <td>{booking.selected_slot}</td>
              <td><span className={`${styles.status} ${statusClass}`}>{booking.status}</span></td>
              <td>{formatAttendanceTime(attendance?.clocked_in_at ?? null)}</td>
              <td>{formatAttendanceTime(attendance?.clocked_out_at ?? null)}</td>
              <td>{attendance ? isLive ? <span className={styles.liveAttendance}><LiveAttendanceTime attendance={attendance} prefix="Live" /></span> : formatWorkedTime(attendance.worked_minutes) : "—"}</td>
              <td>{completed || noShow ? <span className={styles.cardHint}>{completed ? "QR completed" : "No show"}</span> : attendance?.clocked_in_at ? <span className={styles.cardHint}>QR clocked in</span> : <button type="button" className={present ? styles.dangerButton : styles.secondaryButton} onClick={() => handleToggleAttendance(booking.id, booking.status)}>{present ? "Undo" : "Mark present"}</button>}</td>
            </tr>;
          })}
          {currentRoster.length === 0 && <tr><td colSpan={7}><div className={styles.empty}>No volunteers have booked this event.</div></td></tr>}
        </tbody>
      </table>
    </div>}
  </section>;
}
