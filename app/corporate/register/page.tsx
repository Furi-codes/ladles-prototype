/**
 * Opens business registration through the shared authentication screen.
 * A separate URL can select the business form without creating a different sign-in system.
 */

import LoginForm from '@/presentation/auth/LoginForm';

/** Existing registration links open the same entry screen, not the corporate dashboard layout. */
export default function CorporateRegistrationPage() {
  return <LoginForm initialMode="business" />;
}
