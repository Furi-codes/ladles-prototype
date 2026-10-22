"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { corporateRolloutEnabled, corporateBookingsEnabled } from '@/lib/feature-flags';
import { getCorporateAccountDetail, getMyCorporateAccount, saveCorporateAccount } from '@/lib/actions/corporate-accounts';
import type { CorporateAccountDetail } from '@/lib/corporate-account-types';
import CorporateFrame from './components/CorporateFrame';
import CorporateAccountForm from './components/CorporateAccountForm';
import AccountHistory from './components/AccountHistory';
import AccountNotices from './components/AccountNotices';
import styles from '@/app/admin/admin.module.css';
import ui from './corporate.module.css';

/** Account approval is implemented first. No placeholder bookings or payments are created here. */
export default function CorporateAccountPage() {
  const router = useRouter();
  const [detail, setDetail] = useState<CorporateAccountDetail | null>(null);
  const [volunteerAccess, setVolunteerAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [profileDirty, setProfileDirty] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const load = useCallback(async () => {
    if (!corporateRolloutEnabled) return;
    setLoading(true); setError('');
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      // An absent session needs sign-in; a network failure needs a retry, not a misleading redirect.
      if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
      if (!data.user) { router.replace('/?portal=corporate'); return; }
      const account = await getMyCorporateAccount();
      if (!account) { router.replace('/corporate/register'); return; }
      const [{ data: profile, error: profileError }, accountDetail] = await Promise.all([
        supabase.from('profiles').select('volunteer_enabled').eq('id', data.user.id).single(), getCorporateAccountDetail(account.id),
      ]);
      if (profileError) throw profileError;
      setVolunteerAccess(profile?.volunteer_enabled === true); setDetail(accountDetail);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Account could not be loaded.'); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  if (!corporateRolloutEnabled) return <CorporateFrame><h1>Corporate access is not enabled yet</h1><Link href="/">Back to sign in</Link></CorporateFrame>;
  return <CorporateFrame signedIn workflowAccess={detail?.account.status === 'Approved'}><div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>My business account</h1><p className={styles.pageDescription}>Account approval, contact details and updates.</p></div>{volunteerAccess && <Link className={styles.secondaryButton} href="/volunteer">Open volunteer workspace</Link>}</div>
    {loading && <p role="status">Loading your account…</p>}
    {error && <div className={styles.error} role="alert">{error}<button className={styles.secondaryButton} onClick={() => void load()}>Retry</button></div>}
    {message && <p className={ui.notice} role="status">{message}</p>}
    {!loading && !error && detail && <>
      <section className={`${styles.card} ${ui.body}`}><span className={ui.badge}>{detail.account.status}</span><h2>{detail.account.company_name}</h2><p>{detail.account.status === 'Awaiting approval' ? 'An administrator will review your organisation before corporate booking access is granted.' : detail.account.status === 'Rejected' ? 'Your account was not approved. Contact the Ladles team using your existing external contact to discuss reconsideration; keep this account rather than registering again.' : 'Your organisation has been approved.'}</p>{detail.account.review_reason && <p>Latest review: {detail.account.review_reason}</p>}<p>Email verification: {detail.email_verified ? 'Verified' : 'Not verified — administrator approval is blocked'}</p><div className={ui.notice}>{corporateBookingsEnabled && detail.account.status === 'Approved' ? <Link href="/corporate/bookings">Open corporate bookings and published opportunities</Link> : 'Corporate booking access is not enabled here yet. No places or payments are reserved from this profile screen.'}</div></section>
      <section className={`${styles.card} ${ui.body}`}><h2>Company & main contact</h2><p>Contact email edits do not change your login email. Admin receives an update; your approval status is retained.</p><CorporateAccountForm key={detail.account.updated_at + formVersion} initial={detail.account} onDirtyChange={setProfileDirty} label="Save business profile" submit={async input => {
        await saveCorporateAccount(detail.account.id, input);
        // Once a write is committed, don't describe a failed refresh as a failed save (which invites duplicate retries).
        setMessage('Profile saved. Admin has been notified.'); await load();
      }} /></section>
      <AccountNotices goToAccount={async id => {
        if (profileDirty && !window.confirm('Discard your unsaved profile details and open this account?')) throw new Error('Account navigation cancelled. Your form is unchanged.');
        const result = await getCorporateAccountDetail(id); setDetail(result); setProfileDirty(false); setFormVersion(current => current + 1); setMessage('Opened the account linked to this notification.'); window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />
      <section className={`${styles.card} ${ui.body}`}><AccountHistory rows={detail.history} /></section>
    </>}
  </CorporateFrame>;
}
