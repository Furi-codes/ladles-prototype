"use client";
/**
 * Shows the route error fallback with a retry action.
 * Users see a safe recovery message rather than internal exception details.
 */

import styles from "@/styles/volunteer.module.css";

export default function VolunteerError({ reset }: { reset: () => void }) {
  return <main className={styles.loadingScreen}><section className={styles.errorCard} role="alert"><h1>Something went wrong</h1><p>The volunteer portal could not be loaded.</p><button type="button" className={styles.primaryButton} onClick={reset}>Try again</button></section></main>;
}
