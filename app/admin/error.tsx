"use client";
/**
 * Shows the route error fallback with a retry action.
 * Users see a safe recovery message rather than internal exception details.
 */

import StatusPage from '@/components/experience/StatusPage';

export default function AdminError({ reset }: { reset: () => void }) {
  return <StatusPage title="Let’s try that again." message="The administration area could not be loaded. Your next step is to retry or return to sign in." reset={reset} />;
}
