"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { corporateRolloutEnabled } from '@/lib/feature-flags';
import { supabase } from '@/lib/supabase';
import { cleanCorporateAccount, getMyCorporateAccount, registerCorporateAccount, requireCorporateRegistrationOpen } from '@/lib/actions/corporate-accounts';
import type { CorporateAccountInput } from '@/lib/corporate-account-types';
import CorporateAccountForm from '../components/CorporateAccountForm';
import CorporateFrame from '../components/CorporateFrame';
import styles from '@/app/admin/admin.module.css';
import ui from '../corporate.module.css';

export default function CorporateRegistrationPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const [resending, setResending] = useState(false);
  useEffect(() => {
    if (!corporateRolloutEnabled) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        // No session is normal for a registration page. Other errors must remain visible.
        if (error && error.name !== 'AuthSessionMissingError') throw error;
        if (!active) return;
        setUser(data.user);
        if (data.user && await getMyCorporateAccount()) router.replace('/corporate');
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Account access could not be checked.'); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [router]);
  async function submit(input: CorporateAccountInput, password: string) {
    const details = cleanCorporateAccount(input);
    if (user) {
      // Existing users add membership after authentication. Their volunteer identity is not rewritten.
      await registerCorporateAccount(details); router.replace('/corporate'); return;
    }
    if (password.length < 8) throw new Error('Use a password of at least eight characters.');
    // Do not create an Auth user against a deployment whose corporate migration is missing/disabled.
    await requireCorporateRegistrationOpen();
    const { error } = await supabase.auth.signUp({ email: details.contact_email, password, options: {
      emailRedirectTo: `${window.location.origin}/corporate`,
      data: { full_name: details.contact_name, phone: details.contact_phone, registration_kind: 'corporate', corporate_details: details },
    } });
    if (error) throw new Error(error.message);
    setReceipt(details.contact_email);
  }
  async function resend() {
    setResending(true); setError('');
    try { const { error } = await supabase.auth.resend({ type: 'signup', email: receipt, options: { emailRedirectTo: `${window.location.origin}/corporate` } }); if (error) throw error; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not request another verification email.'); }
    finally { setResending(false); }
  }
  if (!corporateRolloutEnabled) return <CorporateFrame><h1>Business registration is not open yet</h1><Link href="/">Back to sign in</Link></CorporateFrame>;
  return <CorporateFrame signedIn={Boolean(user)}><div><h1 className={styles.pageTitle}>Register your organisation</h1><p className={styles.pageDescription}>One main point of contact. Email verification and admin approval are required.</p></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {checking ? <p role="status">Checking account…</p> : receipt ? <section className={`${styles.card} ${ui.body}`}><h2>Check your email</h2><p>If this address can be registered, a verification link will be sent to {receipt}. Verify it, then sign in to view your account review.</p><p>If you already have an account, sign in instead—do not create a second login.</p><div className={ui.actions}><Link className={styles.primaryButton} href="/?portal=corporate">Sign in</Link><button className={styles.secondaryButton} disabled={resending} onClick={() => void resend()}>{resending ? 'Requesting…' : 'Resend verification email'}</button></div></section> : <section className={`${styles.card} ${ui.body}`}>
      <p>{user ? `Adding business access to ${user.email}. Your existing volunteer profile and bookings remain unchanged.` : <>Already a volunteer? <Link href="/?portal=corporate">Sign in to your existing account first</Link>. Your contact email below will be your new login email.</>}</p>
      <CorporateAccountForm key={user?.id || 'new'} initial={user ? { company_name: '', contact_name: user.user_metadata.full_name || '', contact_email: user.email || '', contact_phone: '', billing_address: '' } : undefined} submit={submit} label={user ? 'Request business account approval' : 'Register business'}>{!user ? <p className={styles.helper}>You will receive an authentication verification email. Operational booking/payment communication will not be emailed automatically.</p> : null}</CorporateAccountForm>
    </section>}
  </CorporateFrame>;
}
