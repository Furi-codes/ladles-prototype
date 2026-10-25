/**
 * Opens the shared community sign-in and registration screen.
 * The route stays small; authentication forms and account-routing behaviour live in the auth
 * feature.
 */

import LoginForm from "@/features/auth/LoginForm";

/** Renders the account entry screen; profile-based redirects happen inside LoginForm. */
export default function LoginPage() {
  return <LoginForm />;
}
