"use client";
/**
 * Opens the volunteer impact view at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import CommunityParticipation from "@/features/volunteer/impact/CommunityParticipation";
import ProgressionPanel from "@/features/volunteer/impact/ProgressionPanel";
import VolunteerHistory from '@/features/volunteer/bookings/VolunteerHistory';
import { useVolunteerData } from "@/features/volunteer/shell/VolunteerProvider";
import styles from "@/styles/volunteer.module.css";

export default function VolunteerImpactPage() {
  const { user, profile, events, bookings, attendanceRecords, isLoading, loadError } = useVolunteerData();

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>My impact</h1><p className={styles.pageDescription}>Your time, your history, and the difference you are part of.</p></div>
    </section>
    <div className={styles.impactStack}>
      {isLoading ? <p className={styles.emptySmall}>Loading your contribution…</p> : loadError ? <p role="alert" className={styles.messageError}>{loadError}</p> : <ProgressionPanel bookings={bookings} attendanceRecords={attendanceRecords} events={events} profile={profile} userId={user?.id} />}
      {!isLoading && !loadError && <VolunteerHistory bookings={bookings} attendance={attendanceRecords} events={events} userId={user?.id} />}
      <CommunityParticipation />
    </div>
  </>;
}
