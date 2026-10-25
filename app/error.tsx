"use client";
/**
 * Shows the route error fallback with a retry action.
 * Users see a safe recovery message rather than internal exception details.
 */

import Link from 'next/link';
import styles from '@/styles/volunteer.module.css';

/** Unhandled page failures get a recovery screen, never the exception or its stack trace. */
export default function PageError({ reset }: { reset: () => void }) {
  return <main className={`portalUi ${styles.shell}`}><div className={styles.content}><section className={styles.card} style={{ padding: 24 }} role="alert">
    <h1 className={styles.pageTitle}>This page could not be loaded</h1>
    <p className={styles.cardHint}>Please try again. If the problem continues, contact the Ladles of Love team.</p>
    <div className={styles.modalActions}><button type="button" className={styles.primaryButton} onClick={reset}>Try again</button><Link className={styles.secondaryButton} href="/">Back to sign in</Link></div>
  </section></div></main>;
}
