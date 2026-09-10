import type { Profile } from "@/lib/types";
import styles from "../volunteer.module.css";

export default function WelcomeCard({ profile, activeShifts, eventsCount }: { profile: Profile | null; activeShifts: number; eventsCount: number }) {
  const name = profile?.full_name || "Volunteer";
  return <section className={`${styles.card} ${styles.welcomeCard}`}><p className={styles.welcomeText}>Welcome back, <strong>{name}</strong>. You have <strong>{activeShifts}</strong> active shift{activeShifts === 1 ? "" : "s"}.</p><span className={styles.eventCount}>{eventsCount} event{eventsCount === 1 ? "" : "s"} available</span></section>;
}
