"use client";
import { getAuthenticatedUser, sendRecoveryEmail } from '@/business/shared/auth/session';

/**
 * Shows the business sign-in identity and password controls.
 * Auth recovery is kept separate from editable company contact details.
 */

import { userFacingError } from '@/business/shared/errors/user-facing';

import { useRef, useState } from 'react';
import styles from '@/presentation/styles/volunteer.module.css';
import ui from '@/presentation/styles/corporate.module.css';

/** Recovery uses the verified Auth address, never the editable booking contact email. */
export default function CorporateAccountSecurity({ email, verified }: { email: string; verified: boolean }) {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  return <section className={styles.card} aria-labelledby="corporate-account-settings"><div className={styles.cardHeader}><div><h2 id="corporate-account-settings" className={styles.cardTitle}>Account settings</h2><p className={styles.cardHint}>Your sign-in details are separate from the company’s booking contact.</p></div></div><div className={ui.cardBody}>
    <dl><dt>Sign-in email</dt><dd>{email || 'Unavailable — refresh your account before requesting recovery.'}</dd><dt>Email verification</dt><dd>{verified ? 'Verified' : 'Verification required — check your sign-in email for the verification link.'}</dd></dl>
    <p>This address is used to sign in and recover your password. Updating the contact email below does not change it.</p>
    <button type="button" className={styles.secondaryButton} disabled={!email || busy || sent} onClick={async () => {
      if (pending.current || sent || !email) return;
      pending.current = true; setBusy(true); setError('');
      try {
        // Re-check the active identity in case another tab signed into a different account.
        const { data, error: authError } = await getAuthenticatedUser();
        if (authError || data.user?.email !== email) throw new Error('Your session changed. Refresh this page before requesting a password reset.');
        const { error: recoveryError } = await sendRecoveryEmail(email, { redirectTo: window.location.origin + '/update-password' });
        if (recoveryError) throw recoveryError;
        setSent(true);
      } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Recovery could not be requested. Please try again.', "Recovery could not be requested. Please try again.")); }
      finally { pending.current = false; setBusy(false); }
    }}>{busy ? 'Requesting reset…' : sent ? 'Reset requested' : 'Send password-reset email'}</button>
    {sent && <p role="status">Password reset requested for your sign-in email. Check your inbox and spam folder, then follow the link to choose a new password. Delivery depends on the service’s email configuration.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div></section>;
}
