"use client";
/**
 * Shows the route error fallback with a retry action.
 * Users see a safe recovery message rather than internal exception details.
 */

import styles from "@/styles/admin.module.css";

export default function AdminError({ reset }: { reset: () => void }) {
  return <section className={`${styles.card} ${styles.placeholder}`} role="alert"><h2 className={styles.placeholderTitle}>Something went wrong</h2><p className={styles.placeholderText}>The administration area could not be loaded.</p><button type="button" className={styles.primaryButton} onClick={reset}>Try again</button></section>;
}
