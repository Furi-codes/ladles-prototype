"use client";

import Image from "next/image";
import { formatWorkedTime, getVerifiedContribution } from "@/lib/attendance-utils";
import { useState } from "react";
import type { AttendanceRecord, Booking, Event, Profile } from "@/lib/types";
import styles from "../volunteer.module.css";
import ui from './experience.module.css';

type ProgressionPanelProps = {
  bookings: Booking[];
  attendanceRecords: AttendanceRecord[];
  events: Event[];
  profile: Profile | null;
  userId: string | undefined;
};

function formatPrintDate() {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
}

export default function ProgressionPanel({ bookings, attendanceRecords, profile, userId }: ProgressionPanelProps) {
  const { completed, totalMinutes } = getVerifiedContribution(bookings, attendanceRecords, userId);
  const [printError, setPrintError] = useState<string | null>(null);
  const noShows = bookings.filter((booking) => booking.user_id === userId && booking.status === "No show").length;
  const incomplete = bookings.filter((booking) => booking.user_id === userId && booking.status === "Present").length;
  const certificateAvailable = totalMinutes > 0;

  function printCertificate() {
    if (!certificateAvailable) return;
    setPrintError(null);
    const originalTitle = document.title;
    document.body.classList.add("printing-progress");
    document.title = `Certificate of appreciation - ${profile?.full_name ?? "Ladles of Love"}`;
    const cleanup = () => {
      document.body.classList.remove("printing-progress");
      document.title = originalTitle;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    try { window.print(); } catch { cleanup(); setPrintError("The print window could not open. Please try again."); }
  }

  return <>
    <section className={ui.stats} aria-label="My impact totals">{[['Verified hours', formatWorkedTime(totalMinutes)], ['Completed shifts', completed.length], ['Clock-out needed', incomplete]].map(([label,value]) => <article className={ui.stat} key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>My certificate</h2><p className={styles.cardHint}>A little recognition for the time you have given.</p></div><span className={ui.badge}>{certificateAvailable ? 'Ready to save' : 'Not yet eligible'}</span></div>
      <div className={ui.certificate}><Image src="/Ladles-logo.png" width={64} height={64} alt="Ladles of Love" /><h3>Certificate of Appreciation</h3><p>Presented to</p><strong>{profile?.full_name || 'Volunteer'}</strong><p>{formatWorkedTime(totalMinutes)} of verified volunteer service<br />Across {completed.length} completed shifts</p><p>Thank you for helping us serve communities with dignity and care.</p></div>
      <div className={styles.progressFooter}><span className={styles.progressNote}>{certificateAvailable ? 'Choose Save as PDF in the print window to keep your certificate.' : 'Complete a shift with recorded clock-in and clock-out to unlock your certificate.'}</span><button type="button" className={styles.primaryButton} onClick={printCertificate} disabled={!certificateAvailable}>Download certificate</button></div>
      {printError && <p className={styles.messageError} role="alert">{printError}</p>}
    </section>
    {(incomplete > 0 || noShows > 0) && <section className={styles.card}><div className={ui.body}><h2 className={styles.cardTitle}>Attendance notes</h2>{incomplete > 0 && <p>{incomplete} shift{incomplete === 1 ? '' : 's'} still need a clock-out. If a past shift is incomplete, ask the event organiser to check your attendance record.</p>}{noShows > 0 && <p>{noShows} booking{noShows === 1 ? '' : 's'} marked as a no-show. These do not contribute verified hours.</p>}</div></section>}

    <section className={styles.progressPrintReport} aria-hidden="true" data-volunteer-certificate>
      <header className={styles.progressPrintHeader}><Image src="/Ladles-logo.png" width={124} height={124} alt="Ladles of Love" priority /><p className={styles.progressPrintKicker}>Ladles of Love Volunteer Portal</p></header>
      <section className={styles.progressPrintCertificate}><h1>Certificate of Appreciation</h1><p>This certificate is proudly presented to</p><strong>{profile?.full_name || "Volunteer"}</strong><p>In recognition of their valued contribution to Ladles of Love. Your time, care and commitment help us serve communities with dignity.</p><dl><div><dt>Verified contribution</dt><dd>{formatWorkedTime(totalMinutes)}</dd></div><div><dt>Completed shifts</dt><dd>{completed.length}</dd></div><div><dt>Issued</dt><dd>{formatPrintDate()}</dd></div></dl></section>
      <footer className={styles.progressPrintFooter}><p>Thank you for volunteering with Ladles of Love.</p><span>Ladles of Love</span></footer>
    </section>
  </>;
}
