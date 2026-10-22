"use client";

import { useCallback, useEffect, useState } from 'react';
import { corporateRolloutEnabled } from '@/lib/feature-flags';
import { getCorporateAccountDetail, getCorporateRolloutSettings, reviewCorporateAccount, searchCorporateAccounts, setCorporateRolloutSettings } from '@/lib/actions/corporate-accounts';
import type { CorporateAccountDetail, CorporateAccountStatus, CorporateRolloutSettings } from '@/lib/corporate-account-types';
import { useUnsavedChanges } from '@/app/components/useUnsavedChanges';
import { FeatureState, useFeatureData } from '../components/FeatureShared';
import AccountHistory from '@/app/corporate/components/AccountHistory';
import AccountNotices from '@/app/corporate/components/AccountNotices';
import styles from '../admin.module.css';
import management from '../components/management.module.css';
import ui from '@/app/corporate/corporate.module.css';

export default function CorporateAccountAdministration() {
  if (!corporateRolloutEnabled) return <p>Corporate account rollout is not enabled on this deployment.</p>;
  return <AccountAdministration />;
}

/** Separate from legacy CSR: reviews new self-service accounts, not shared volunteer-slot bookings. */
function AccountAdministration() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CorporateAccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('accounts');
  const [detail, setDetail] = useState<CorporateAccountDetail | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rolloutDirty, setRolloutDirty] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('account'); if (!id) return;
    let active = true;
    void getCorporateAccountDetail(id).then(result => { if (active) setDetail(result); }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Account could not be opened.'); });
    return () => { active = false; };
  }, []);
  const confirmDiscard = useUnsavedChanges(Boolean(reason) || rolloutDirty);
  const loader = useCallback(() => searchCorporateAccounts(query, status, page), [query, status, page]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  async function open(id: string) {
    if (busy || !confirmDiscard()) throw new Error('Account navigation cancelled. Your current form is unchanged.');
    setBusy(true); setError('');
    try { const result = await getCorporateAccountDetail(id); setDetail(result); setReason(''); setTab('accounts'); }
    finally { setBusy(false); }
  }
  async function decide(decision: 'approve' | 'reject' | 'reconsider') {
    if (!detail || busy || !reason.trim() || !window.confirm(`Confirm this account decision: ${decision}? It will be logged and the business contact will receive an in-app update.`)) return;
    setBusy(true); setError('');
    try {
      const saved = await reviewCorporateAccount(detail.account.id, decision, reason);
      setReason(''); setMessage('Account decision saved; contact notified.');
      // Keep the committed result visible even if the follow-up history refresh fails.
      setDetail(current => current ? { ...current, account: saved } : null);
      try { setDetail(await getCorporateAccountDetail(saved.id)); } catch { setMessage('Decision saved, but history could not be refreshed. Reopen the account to check its latest history.'); }
      void reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Decision could not be saved.'); }
    finally { setBusy(false); }
  }
  function switchTab(next: string) { if (!busy && confirmDiscard()) { setReason(''); setRolloutDirty(false); setTab(next); } }
  const openFromButton = (id: string) => { void open(id).catch(failure => setError(failure instanceof Error ? failure.message : 'Account could not be opened.')); };
  return <div className={management.workspace}>
    <div><h1 className={styles.pageTitle}>Corporate accounts</h1><p className={styles.pageDescription}>Review registrations and main-contact details. This does not change existing volunteer/WMS bookings.</p></div>
    <nav className={ui.tabs} aria-label="Corporate administration">{[['accounts','Account approvals'],['notifications','Notifications'],['rollout','Access settings']].map(([key, title]) => <button key={key} disabled={busy} aria-pressed={key === tab} onClick={() => switchTab(key)}>{title}</button>)}</nav>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={ui.notice} role="status">{message}</p>}
    {tab === 'accounts' && <>
      <section className={styles.card}><form className={management.filters} onSubmit={event => { event.preventDefault(); if (confirmDiscard()) { setReason(''); setDetail(null); setPage(1); void reload(); } }}>
        <label>Search company / main contact<input className={styles.input} type="search" maxLength={180} value={query} disabled={busy || Boolean(reason)} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        <label>Account status<select className={styles.select} value={status} disabled={busy || Boolean(reason)} onChange={event => { setStatus(event.target.value as CorporateAccountStatus | ''); setPage(1); }}><option value="">All statuses</option>{['Awaiting approval','Approved','Rejected'].map(value => <option key={value}>{value}</option>)}</select></label>
        <button className={styles.secondaryButton} disabled={busy}>Refresh</button>
      </form><FeatureState loading={loading} error={loadError} retry={() => void reload()} />
      {!loading && !loadError && <><div className={management.tableViewport}><table className={styles.table}><thead><tr><th>Company</th><th>Main contact</th><th>Contact details</th><th>Status / verification</th><th>Actions</th></tr></thead><tbody>{data?.rows.map(account => <tr key={account.id}><td>{account.company_name}</td><td>{account.contact_name}</td><td>{account.contact_email}<br />{account.contact_phone}</td><td><span className={ui.badge}>{account.status}</span><br />{account.email_verified ? 'Email verified' : 'Email not verified'}</td><td><button className={styles.secondaryButton} disabled={busy} onClick={() => openFromButton(account.id)}>Review account</button></td></tr>)}{!data?.rows.length && <tr><td colSpan={5}>No matching corporate accounts.</td></tr>}</tbody></table></div>
      <div className={management.filters}><button className={styles.secondaryButton} disabled={page === 1 || busy || Boolean(reason)} onClick={() => setPage(page - 1)}>Previous</button><span>{data?.total ?? 0} accounts · Page {page}</span><button className={styles.secondaryButton} disabled={page * 10 >= (data?.total ?? 0) || busy || Boolean(reason)} onClick={() => setPage(page + 1)}>Next</button></div></>}
      </section>
      {detail && <section className={`${styles.card} ${ui.body}`}><h2>{detail.account.company_name}</h2><span className={ui.badge}>{detail.account.status}</span><dl className={management.profile}><div><dt>Main contact</dt><dd>{detail.account.contact_name}</dd></div><div><dt>Email</dt><dd><a href={'mailto:' + detail.account.contact_email}>{detail.account.contact_email}</a></dd></div><div><dt>Phone</dt><dd><a href={'tel:' + detail.account.contact_phone.replace(/[^+0-9]/g,'')}>{detail.account.contact_phone}</a></dd></div><div><dt>Billing address</dt><dd>{detail.account.billing_address}</dd></div><div><dt>Login email verification</dt><dd>{detail.email_verified ? 'Verified by Auth' : 'Not verified — approval is blocked'}</dd></div><div><dt>Latest review</dt><dd>{detail.account.review_reason || 'Not reviewed'}</dd></div></dl>
        {detail.account.status !== 'Approved' && <div><label className={styles.field}><span className={styles.fieldLabel}>Decision / external follow-up reason</span><textarea className={styles.input} style={{ minHeight: 80, paddingTop: 12 }} required maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label><div className={styles.formActions}>{detail.account.status === 'Rejected' ? <button className={styles.primaryButton} disabled={busy || !reason.trim()} onClick={() => void decide('reconsider')}>Reconsider existing account</button> : <><button className={styles.primaryButton} disabled={busy || !reason.trim() || !detail.email_verified} onClick={() => void decide('approve')}>Approve account</button><button className={styles.dangerButton} disabled={busy || !reason.trim()} onClick={() => void decide('reject')}>Reject account</button></>}</div></div>}
        <AccountHistory rows={detail.history} />
      </section>}
    </>}
    {tab === 'notifications' && <AccountNotices goToAccount={open} />}
    {tab === 'rollout' && <RolloutControls dirtyChanged={setRolloutDirty} />}
  </div>;
}

function RolloutControls({ dirtyChanged }: { dirtyChanged: (dirty: boolean) => void }) {
  const { data, loading, error, reload } = useFeatureData(getCorporateRolloutSettings);
  return <section className={`${styles.card} ${ui.body}`}><h2>Registration & volunteer details</h2><p>Choose whether businesses can register and whether volunteers must provide a cellphone number before making a new booking. Existing attendance and cancellations remain available. Corporate booking availability is managed separately under Corporate bookings. Enable phone enforcement after deploying the updated signup/profile forms.</p><FeatureState loading={loading} error={error} retry={() => void reload()} />{data && !loading && !error && <RolloutForm key={data.updated_at} initial={data} saved={reload} dirtyChanged={dirtyChanged} />}</section>;
}
function RolloutForm({ initial, saved, dirtyChanged }: { initial: CorporateRolloutSettings; saved: () => Promise<void>; dirtyChanged: (dirty: boolean) => void }) {
  const [registration, setRegistration] = useState(initial.registration_enabled);
  const [phone, setPhone] = useState(initial.volunteer_phone_required);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return <form onSubmit={async event => {
    event.preventDefault(); if (busy || !window.confirm('Apply these rollout controls? Phone enforcement will block NEW bookings without a saved phone; existing attendance and cancellation remain available.')) return;
    setBusy(true); setError('');
    try { await setCorporateRolloutSettings(registration, phone); dirtyChanged(false); setMessage('Rollout controls saved.'); await saved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Rollout controls could not be saved.'); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Schema version {initial.schema_version}</legend><label className={management.preference}><input type="checkbox" checked={registration} onChange={event => { setRegistration(event.target.checked); dirtyChanged(event.target.checked !== initial.registration_enabled || phone !== initial.volunteer_phone_required); }} />Open business account registration</label><label className={management.preference}><input type="checkbox" checked={phone} onChange={event => { setPhone(event.target.checked); dirtyChanged(registration !== initial.registration_enabled || event.target.checked !== initial.volunteer_phone_required); }} />Require a saved cellphone for new volunteer bookings</label><p className={ui.notice}>Before opening registration, verify that Supabase email confirmation, allowed redirect URLs, recovery links and email delivery work on this deployment. No operational payment emails are sent by this phase.</p>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}<button className={styles.primaryButton}>Save rollout controls</button></fieldset></form>;
}
