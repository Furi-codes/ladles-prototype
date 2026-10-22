"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { cleanCorporateAccount, getMyCorporateAccount, registerCorporateAccount, requireCorporateRegistrationOpen } from '@/lib/actions/corporate-accounts';
import type { CorporateAccountInput } from '@/lib/corporate-account-types';
import CorporateAccountForm from '@/app/corporate/components/CorporateAccountForm';
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
  const resendPending = useRef(false);
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
      } catch (failure) { if (active) setAccessError(failure instanceof Error ? failure.message : 'Account access could not be checked.'); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [router, checkAttempt]);

  async function submit(input: CorporateAccountInput, password: string) {
    const details = cleanCorporateAccount(input);
    if (user) {
      // Authenticated users add company membership, not a second Auth login.
      await registerCorporateAccount(details); router.replace('/corporate'); return;
    }
    if (password.length < 8 || password.length > 128) throw new Error('Use a password between eight and 128 characters.');
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
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not request another verification email.'); }
    finally { resendPending.current = false; setResending(false); onBusyChange(false); }
  }
  if (checking) return <p className={styles.intro} role="status">Checking account…</p>;
  if (accessError) return <div className={styles.error} role="alert"><p>{accessError}</p><button type="button" className={styles.textButton} onClick={() => { setChecking(true); setCheckAttempt(value => value + 1); }}>Retry account check</button></div>;
  if (receipt) return <div className={styles.fields}><div className={styles.notice} role="status"><h3>Check your email</h3><p>If this address can be registered, a verification link will be sent to {receipt}. After verifying, use the shared sign-in to view your account review.</p><p>Already have a login? Sign in with your existing password, then add business access. Submitting this form again does not upgrade an existing account.</p></div>{error && <p className={styles.error} role="alert">{error}</p>}<button type="button" className={styles.submit} disabled={resending} onClick={() => onSignIn(receipt)}>Back to sign in</button><button type="button" className={styles.google} disabled={resending} onClick={() => void resend()}>{resending ? 'Requesting…' : 'Resend verification email'}</button></div>;
  return <div className={styles.fields}>
    <p className={styles.notice}>{user ? `Adding business access to ${user.email}. Your volunteer profile and bookings stay unchanged.` : <>Already have a volunteer or business login? <button type="button" className={styles.textButton} onClick={() => onSignIn()}>Sign in first</button> to use that account. Otherwise, your contact email below becomes your login email.</>}</p>
    <CorporateAccountForm appearance="auth" key={user?.id || 'new'} initial={user ? { company_name: '', contact_name: user.user_metadata.full_name || '', contact_email: user.email || '', contact_phone: '', billing_address: '' } : undefined} submit={submit} label={user ? 'Request business account approval' : 'Register business'} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}>
      {!user ? <p className={styles.intro}>Email verification and admin approval are required. Payment communication happens externally.</p> : null}
    </CorporateAccountForm>
  </div>;
}
