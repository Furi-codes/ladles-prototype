"use client";
/**
 * Shows the route error fallback with a retry action.
 * Users see a safe recovery message rather than internal exception details.
 */

import StatusPage from '@/components/experience/StatusPage';

export default function VolunteerError({ reset }: { reset: () => void }) {
  return <StatusPage title="Let’s try that again." message="The volunteer page could not be loaded. Retry to get back to your volunteering." reset={reset} />;
}
