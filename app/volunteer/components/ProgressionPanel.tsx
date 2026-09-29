"use client";

import Image from "next/image";
import { formatWorkedTime } from "@/lib/attendance-utils";
import type { AttendanceRecord, Booking, Event, Profile } from "@/lib/types";
import styles from "../volunteer.module.css";

type ProgressionPanelProps = {
  bookings: Booking[];
  attendanceRecords: AttendanceRecord[];
  events: Event[];
  profile: Profile | null;
  userId: string | undefined;
};

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function formatPrintDate() {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
}

export default function ProgressionPanel({ bookings, attendanceRecords, events, profile, userId }: ProgressionPanelProps) {
  const completed = bookings.filter((booking) => booking.user_id === userId && booking.status === "Completed");
  const completedIds = new Set(completed.map((booking) => booking.id));
  const recordsByBookingId = new Map(attendanceRecords.map((record) => [record.booking_id, record]));
  const totalMinutes = attendanceRecords.filter((record) => completedIds.has(record.booking_id)).reduce((total, record) => total + (record.worked_minutes ?? 0), 0);
  const noShows = bookings.filter((booking) => booking.user_id === userId && booking.status === "No show").length;
  const incomplete = bookings.filter((booking) => booking.user_id === userId && booking.status === "Present").length;
  const eventById = new Map(events.map((event) => [event.id, event]));
  const participationRows = completed.map((booking) => ({ booking, event: eventById.get(booking.event_id), attendance: recordsByBookingId.get(booking.id) })).sort((first, second) => (first.event?.date ?? "").localeCompare(second.event?.date ?? ""));

  function printProgression() {
    const originalTitle = document.title;
    document.body.classList.add("printing-progress");
    document.title = `Volunteer participation record - ${profile?.full_name ?? "Ladles of Love"}`;
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("printing-progress");
      document.title = originalTitle;
    }, { once: true });
    window.print();
  }

  return <>
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>My progression</h2><p className={styles.cardHint}>Hours come directly from your recorded clock-in and clock-out times.</p></div></div>
      <table className={styles.table}><thead><tr><th>Progress</th><th>Total</th></tr></thead><tbody><tr><td>Hours volunteered</td><td className={styles.progressValue}>{formatWorkedTime(totalMinutes)}</td></tr><tr><td>Events completed</td><td className={styles.progressValue}>{completed.length}</td></tr><tr><td>No-shows</td><td className={styles.progressValue}>{noShows}</td></tr>{incomplete > 0 && <tr><td>Clock-out needed</td><td className={styles.progressValue}>{incomplete}</td></tr>}</tbody></table>
      <div className={styles.progressFooter}><span className={styles.progressNote}>A shift counts only after its clock-out is recorded.</span><button type="button" className={styles.secondaryButton} onClick={printProgression}>Print participation record</button></div>
    </section>

    <section className={styles.progressPrintReport} aria-hidden="true" data-volunteer-progress-report>
      <header className={styles.progressPrintHeader}><div><p className={styles.progressPrintKicker}>Ladles of Love</p><h1>Volunteer Participation Record</h1><p>This record summarises verified volunteer participation captured by the Volunteer Portal.</p></div><Image src="/Ladles-logo.png" width={124} height={124} alt="Ladles of Love" priority /></header>
      <section className={styles.progressPrintVolunteer}><div><span>Volunteer</span><strong>{profile?.full_name || "Volunteer"}</strong></div><div><span>Report date</span><strong>{formatPrintDate()}</strong></div><div><span>Verified hours</span><strong>{formatWorkedTime(totalMinutes)}</strong></div><div><span>Completed shifts</span><strong>{completed.length}</strong></div></section>
      <section className={styles.progressPrintSection}><h2>Completed volunteer shifts</h2><table className={styles.progressPrintTable}><thead><tr><th>Date</th><th>Event</th><th>Location</th><th>Shift</th><th>Verified hours</th></tr></thead><tbody>{participationRows.length > 0 ? participationRows.map(({ booking, event, attendance }) => <tr key={booking.id}><td>{event ? formatEventDate(event.date) : "—"}</td><td>{event?.title ?? "Event record unavailable"}</td><td>{event?.location ?? "—"}</td><td>{booking.selected_slot || "—"}</td><td>{formatWorkedTime(attendance?.worked_minutes ?? null)}</td></tr>) : <tr><td colSpan={5} className={styles.progressPrintEmpty}>No completed shifts have been recorded yet.</td></tr>}</tbody></table></section>
      <footer className={styles.progressPrintFooter}><p>Thank you for helping Ladles of Love feed communities with dignity and care.</p><p>Only completed shifts with a recorded clock-out contribute to verified hours.</p></footer>
    </section>
  </>;
}
