"use client";
import { userFacingError } from '@/lib/user-facing-error';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { passwordError } from '@/lib/password-policy';
import { cleanCorporateAccount, getMyCorporateAccount, requireCorporateRegistrationOpen } from '@/lib/actions/corporate-accounts';
import type { CorporateAccountInput } from '@/lib/corporate-account-types';
import CorporateAccountForm from '@/app/corporate/components/CorporateAccountForm';
import { useSignOut } from './useSignOut';
import styles from './LoginForm.module.css';

/** Only the business fields live here. Sign-in, branding and tabs belong to the shared entry screen. */
export default function BusinessRegistration({ onSignIn, onDirtyChange, onBusyChange }: {
  onSignIn: (email?: string) => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true), [checkAttempt, setCheckAttempt] = useState(0);
  const [accessError, setAccessError] = useState(''), [error, setError] = useState('');
  const [receipt, setReceipt] = useState(''), [resending, setResending] = useState(false);
  const [resendMessage,setResendMessage]=useState('');
  const resendPending = useRef(false);
  const { signOut, busy: signingOut, error: signOutError } = useSignOut({ redirectTo: '/corporate/register', onSignedOut: () => { setUser(null); } });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error && error.name !== 'AuthSessionMissingError') throw error;
        if (!active) return;
        if (data.user) {
          const account = await getMyCorporateAccount();
          if (!active) return;
          if (account) { router.replace('/corporate'); return; }
        }
        setUser(data.user); setAccessError('');
      } catch (failure) { if (active) setAccessError(userFacingError(failure instanceof Error ? failure.message : 'Account access could not be checked.', "Account access could not be checked.")); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [router, checkAttempt]);

  async function submit(input: CorporateAccountInput, password: string) {
    const details = cleanCorporateAccount(input);
    // Check again at submission: another tab may have signed in since this form was opened.
    const { data: current, error: sessionError } = await supabase.auth.getUser();
    if (sessionError && sessionError.name !== 'AuthSessionMissingError') throw sessionError;
    if (user || current.user) throw new Error('Sign out before registering a separate business account with a different email address.');
    const invalidPassword = passwordError(password);
    if (invalidPassword) throw new Error(invalidPassword);
    await requireCorporateRegistrationOpen();
    const { error } = await supabase.auth.signUp({ email: details.contact_email, password, options: {
      emailRedirectTo: `${window.location.origin}/corporate`,
      data: { full_name: details.contact_name, phone: details.contact_phone, registration_kind: 'corporate', corporate_details: details },
    } });
    if (error) throw new Error(error.message);
    // Auth can return a neutral response for an existing address; do not promise delivery or account creation.
    setReceipt(details.contact_email);
  }
  async function resend() {
    if (resendPending.current) return;
    resendPending.current = true; setResending(true); onBusyChange(true); setError('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: receipt, options: { emailRedirectTo: `${window.location.origin}/corporate` } });
      if (error) throw error;
      setResendMessage('If this address still needs verification, another link has been requested. Check your inbox and spam folder before trying again.');
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Could not request another verification email.', "Could not request another verification email.")); }
    finally { resendPending.current = false; setResending(false); onBusyChange(false); }
  }
  if (checking) return <p className={styles.intro} role="status">Checking account…</p>;
  if (accessError) return <div className={styles.error} role="alert"><p>{accessError}</p><button type="button" className={styles.textButton} onClick={() => { setChecking(true); setCheckAttempt(value => value + 1); }}>Retry account check</button></div>;
  if (receipt) return <div className={styles.fields}><div className={styles.notice} role="status"><h3>Check your email</h3><p>If this address can be registered, a verification link will be sent to {receipt}. After verifying, sign in to view your business account review.</p><p>A volunteer email cannot be reused for a business account. If this email is already registered, sign in to that account or register the business with a different email.</p></div>{error && <p className={styles.error} role="alert">{error}</p>}{resendMessage && <p className={styles.notice} role="status">{resendMessage}</p>}<button type="button" className={styles.submit} disabled={resending} onClick={() => onSignIn(receipt)}>Back to sign in</button><button type="button" className={styles.google} disabled={resending} onClick={() => void resend()}>{resending ? 'Requesting…' : 'Resend verification email'}</button></div>;
  if (user) return <div className={styles.fields}><p className={styles.notice}>You’re signed in as {user.email}. A business account must be registered separately, using a different email address.</p>{signOutError && <p className={styles.error} role="alert">{signOutError}</p>}<button type="button" className={styles.submit} disabled={signingOut} onClick={async () => { onBusyChange(true); try { await signOut(); } finally { onBusyChange(false); } }}>{signingOut ? 'Signing out…' : 'Sign out to register a business'}</button></div>;
  return <div className={styles.fields}>
    <CorporateAccountForm appearance="auth" submit={submit} label="Register business" onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}>
      <p className={styles.intro}>Email verification and admin approval are required. Payment communication happens externally.</p>
    </CorporateAccountForm>
    <p className={styles.footer}><button type="button" className={styles.textButton} onClick={() => onSignIn()}>Already registered? Sign in</button></p>
  </div>;
}
