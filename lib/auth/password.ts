/**
 * Changes the password for the currently authenticated account.
 * The current password and identity are checked again before the update, including after
 * reauthentication.
 */

import { supabase } from '@/lib/supabase/client';
import { passwordError } from '@/lib/auth/password-policy';

/** Verify the current password with Auth; never copy passwords into profiles or activity logs. */
export async function changeAccountPassword(expectedEmail: string, currentPassword: string, newPassword: string, confirmation: string) {
  const invalid = passwordError(newPassword);
  if (invalid) throw new Error(invalid);
  if (newPassword !== confirmation) throw new Error('The new passwords do not match.');
  if (!currentPassword) throw new Error('Enter your current password.');
  if (currentPassword === newPassword) throw new Error('Choose a different password from your current one.');
  const { data: before, error: checkError } = await supabase.auth.getUser();
  if (checkError || !before.user?.email || before.user.email !== expectedEmail) throw new Error('Your session changed. Refresh this page before changing your password.');
  // This signs back into the same account and also refreshes authentication for older sessions.
  const { data: verified, error: verificationError } = await supabase.auth.signInWithPassword({ email: before.user.email, password: currentPassword });
  if (verificationError) {
    if (verificationError.code === 'invalid_credentials') throw new Error('Your current password is incorrect.');
    throw verificationError;
  }
  if (verified.user?.id !== before.user.id) throw new Error('Your account could not be verified. Please sign in again.');
  // A different tab may have changed the account while authentication was pending.
  const { data: latest, error: latestError } = await supabase.auth.getUser();
  if (latestError || latest.user?.id !== before.user.id) throw new Error('Your session changed. Sign in again before changing your password.');
  const { data, error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
  if (error) throw error;
  if (data.user?.id !== before.user.id) throw new Error('The password update could not be confirmed. Sign in again to check your account.');
}
