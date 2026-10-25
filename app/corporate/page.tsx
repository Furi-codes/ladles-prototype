"use client";

import { useCallback, useState } from 'react';
import { getCorporateAccountDetail, saveCorporateAccount } from '@/lib/actions/corporate-accounts';
import { useCorporateWorkspace } from './components/CorporateWorkspaceProvider';
import { useCorporateFeatureData } from './components/useCorporateFeatureData';
import CorporateContentLoading from './components/CorporateContentLoading';
import CorporateAccountForm from './components/CorporateAccountForm';
import AccountHistory from './components/AccountHistory';
import CorporateAccountSecurity from './components/CorporateAccountSecurity';
import CorporatePhotoEditor from './components/CorporatePhotoEditor';
import PersonalReminderPreferences from '@/app/components/PersonalReminderPreferences';
import ChangePasswordForm from '@/app/components/ChangePasswordForm';
import styles from '@/app/volunteer/volunteer.module.css';
import ui from './corporate.module.css';

/** Company details and account review history; booking navigation lives in the shared header. */
export default function CorporateAccountPage() {
  const { data, applyAccount, refreshWorkspace } = useCorporateWorkspace();
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false), [saving, setSaving] = useState(false);
  const [imageEditing, setImageEditing] = useState(false);
  const accountId = data?.account.id;
  const loader = useCallback(() => accountId ? getCorporateAccountDetail(accountId) : Promise.resolve(null), [accountId]);
  const { data: detail, loading, error, reload } = useCorporateFeatureData(loader, !editing && !saving && !imageEditing);
  return <div className={ui.workspace}><div className={`${styles.pageHeading} ${ui.pageHeading}`}><div><h1 className={styles.pageTitle}>Business profile</h1><p className={styles.pageDescription}>Manage your company details, main contact and account updates.</p></div></div>
    {loading && !detail && <CorporateContentLoading message="Loading business details…" />}
    {error && <div className={styles.error} role="alert">{error}<button className={styles.secondaryButton} onClick={() => void reload()}>Retry</button></div>}
    {message && <p className={ui.notice} role="status">{message}</p>}
    {detail && <>
      <section className={styles.card} aria-label="Account status"><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{detail.account.company_name}</h2><span className={ui.badge}>{detail.account.status}</span></div>
        {(detail.account.status !== 'Approved' || !detail.email_verified) && <div className={ui.cardBody}>
          {detail.account.status === 'Awaiting approval' && <p>An administrator will review your organisation before you can request a booking.</p>}
          {detail.account.status === 'Rejected' && <p>Your account was not approved. Contact the Ladles team to discuss reconsideration using this account.</p>}
          {detail.account.status !== 'Approved' && detail.account.review_reason && <p>Latest review: {detail.account.review_reason}</p>}
          {!detail.email_verified && <p>Verify your sign-in email before your account can be approved.</p>}
        </div>}
      </section>
      <CorporatePhotoEditor onActivityChange={setImageEditing} />
      <CorporateAccountSecurity email={data?.signInEmail || ''} verified={Boolean(data?.emailVerified)} />
      <ChangePasswordForm email={data?.signInEmail || ''} />
      <PersonalReminderPreferences portal="corporate" />
      <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Company & main contact</h2><p className={styles.cardHint}>Company identity, booking contact and billing address.</p></div></div><div className={ui.cardBody}><p>The contact email is where the booking team can reach your main contact about bookings and external payments. It is not your sign-in email. Admin is notified of profile updates; your approval status stays the same.</p><CorporateAccountForm key={detail.account.updated_at} initial={detail.account} label="Update profile" onDirtyChange={setEditing} onBusyChange={setSaving} submit={async input => {
        const saved = await saveCorporateAccount(detail.account.id, input);
        applyAccount(saved);
        // Once a write is committed, don't describe a failed refresh as a failed save (which invites duplicate retries).
        setMessage('Profile updated. Admin has been notified.'); void refreshWorkspace(true); await reload();
      }} /></div></section>
      <section className={`${styles.card} ${ui.body}`}><AccountHistory rows={detail.history} /></section>
    </>}
  </div>;
}
