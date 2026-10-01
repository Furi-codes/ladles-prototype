"use client";

import Link from "next/link";
import CommunityParticipation from "../components/CommunityParticipation";
import ProgressionPanel from "../components/ProgressionPanel";
import VolunteerHistory from '../components/VolunteerHistory';
import { useVolunteerData } from "../components/VolunteerProvider";
import styles from "../volunteer.module.css";

export default function VolunteerImpactPage() {
  const { user, profile, events, bookings, attendanceRecords, isLoading, loadError } = useVolunteerData();

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>My impact</h1><p className={styles.pageDescription}>Your time, your history, and the difference you are part of.</p></div>
      <Link href="/volunteer" className={styles.secondaryButton}>Back to dashboard</Link>
    </section>
    <div className={styles.impactStack}>
      {isLoading ? <p className={styles.emptySmall}>Loading your contribution…</p> : loadError ? <p role="alert" className={styles.messageError}>{loadError}</p> : <ProgressionPanel bookings={bookings} attendanceRecords={attendanceRecords} events={events} profile={profile} userId={user?.id} />}
      {!isLoading && !loadError && <VolunteerHistory bookings={bookings} attendance={attendanceRecords} events={events} userId={user?.id} />}
      <CommunityParticipation />
    </div>
  </>;
}
