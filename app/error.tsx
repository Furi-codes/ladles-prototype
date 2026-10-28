"use client";
/**
 * Shows the route error fallback with a retry action.
 * Users see a safe recovery message rather than internal exception details.
 */

import StatusPage from '@/presentation/components/experience/StatusPage';
import styles from '@/presentation/components/experience/status-page.module.css';

/** Unhandled page failures get a recovery screen, never the exception or its stack trace. */
export default function PageError({ reset }: { reset: () => void }) {
  return <main data-experience="system" className={`portalUi ${styles.page}`}><StatusPage title="Let’s try that again." message="This page could not be loaded. Try again, or return to sign in. If the problem continues, contact the Ladles of Love team." reset={reset} /></main>;
}
