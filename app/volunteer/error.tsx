"use client";

import styles from "./volunteer.module.css";

export default function VolunteerError({ reset }: { reset: () => void }) {
  return <main className={styles.loadingScreen}><section className={styles.errorCard} role="alert"><h1>Something went wrong</h1><p>The volunteer portal could not be loaded.</p><button type="button" className={styles.primaryButton} onClick={reset}>Try again</button></section></main>;
}
