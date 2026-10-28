/**
 * Opens the password form used after an Auth recovery link.
 * Link checking and password submission live in the auth feature rather than this route wrapper.
 */

import ResetPasswordForm from "@/presentation/auth/ResetPasswordForm";

export default function UpdatePasswordPage() {
  return <ResetPasswordForm />;
}
