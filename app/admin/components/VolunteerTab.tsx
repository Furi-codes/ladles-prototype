"use client";
import { Event, Booking } from "../../../lib/types";
import { useState } from "react";
import { updateBookingAttendance } from "@/lib/actions/admin";
import styles from "../admin.module.css";

export default function VolunteerView({ events, bookings }: { events: Event[]; bookings: Booking[] }) {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<number, "Present" | "Confirmed">>({});
  const currentRoster = bookings.map((booking) => ({ ...booking, status: attendanceOverrides[booking.id] ?? booking.status })).filter((booking) => booking.event_id.toString() === selectedEventId);

  async function handleToggleAttendance(bookingId: number, currentStatus: string) {
    const newStatus = currentStatus === "Present" ? "Confirmed" : "Present";
    setAttendanceOverrides((previous) => ({ ...previous, [bookingId]: newStatus }));
    try { const { error } = await updateBookingAttendance(bookingId, newStatus); if (error) throw error; } catch (error) { console.error("Failed to update attendance:", error); setAttendanceOverrides((previous) => { const next = { ...previous }; delete next[bookingId]; return next; }); }
  }

  return <section className={styles.card} aria-labelledby="attendance-title"><div className={styles.cardHeader}><div><h2 id="attendance-title" className={styles.cardTitle}>Attendance</h2><p className={styles.cardHint}>Select an event to view and update its roster.</p></div><select className={styles.select} style={{ width: "min(280px, 48vw)" }} value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} aria-label="Select an event"><option value="">Select an event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title} · {event.date}</option>)}</select></div>{selectedEventId === "" ? <div className={styles.empty}>Select an event to view its volunteer roster.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Volunteer", "Time range", "Status", "Action"].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{currentRoster.map((booking) => { const present = booking.status === "Present"; return <tr key={booking.id}><td>{booking.volunteer_name}</td><td>{booking.selected_slot}</td><td><span className={`${styles.status} ${present ? styles.statusPresent : styles.statusConfirmed}`}>{present ? "Present" : "Confirmed"}</span></td><td><button type="button" className={present ? styles.dangerButton : styles.secondaryButton} onClick={() => handleToggleAttendance(booking.id, booking.status)}>{present ? "Undo" : "Mark present"}</button></td></tr>; })}{currentRoster.length === 0 && <tr><td colSpan={4}><div className={styles.empty}>No volunteers have booked this event.</div></td></tr>}</tbody></table></div>}</section>;
}
