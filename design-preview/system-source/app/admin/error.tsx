"use client";

import styles from "./admin.module.css";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section className={`${styles.card} ${styles.placeholder}`} role="alert"><h2 className={styles.placeholderTitle}>Something went wrong</h2><p className={styles.placeholderText}>The administration area could not be loaded.</p><button type="button" className={styles.primaryButton} onClick={reset}>Try again</button></section>;
}
