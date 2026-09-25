"use client";

import Link from "next/link";
import CommunityParticipation from "../components/CommunityParticipation";
import ProgressionPanel from "../components/ProgressionPanel";
import { useVolunteerData } from "../components/VolunteerProvider";
import styles from "../volunteer.module.css";

export default function VolunteerImpactPage() {
  const { user, bookings, attendanceRecords } = useVolunteerData();

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>My impact</h1><p className={styles.pageDescription}>Review your recorded hours and the community participation trend.</p></div>
      <Link href="/volunteer" className={styles.secondaryButton}>Back to dashboard</Link>
    </section>
    <div className={styles.impactStack}>
      <ProgressionPanel bookings={bookings} attendanceRecords={attendanceRecords} userId={user?.id} />
      <CommunityParticipation />
    </div>
  </>;
}
