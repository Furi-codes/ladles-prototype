"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { corporateRolloutEnabled } from '@/lib/feature-flags';
import { getCorporateAccountDetail, getCorporateRolloutSettings, reviewCorporateAccount, searchCorporateAccounts, setCorporateRolloutSettings } from '@/lib/actions/corporate-accounts';
import type { CorporateAccountDetail, CorporateAccountStatus, CorporateRolloutSettings } from '@/lib/corporate-account-types';
import { useUnsavedChanges } from '@/app/components/useUnsavedChanges';
import { FeatureState, useFeatureData } from '../components/FeatureShared';
import AccountHistory from '@/app/corporate/components/AccountHistory';
import ContactOptions from '@/app/components/ContactOptions';
import styles from '../admin.module.css';
import management from '../components/management.module.css';
import ui from '@/app/corporate/corporate.module.css';

export default function CorporateAccountAdministration() {
  if (!corporateRolloutEnabled) return <p>Corporate account rollout is not enabled on this deployment.</p>;
  return <Suspense fallback={<p role="status">Loading corporate accounts…</p>}><CorporateAccountRoute /></Suspense>;
}
function CorporateAccountRoute() {
  const accountId = useSearchParams().get('account');
  return <AccountAdministration key={accountId || 'accounts'} accountId={accountId} />;
}

/** Separate from legacy CSR: reviews new self-service accounts, not shared volunteer-slot bookings. */
function AccountAdministration({ accountId }: { accountId: string | null }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CorporateAccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('accounts');
  const [detail, setDetail] = useState<CorporateAccountDetail | null>(null);
  const selectedAccount = useRef<HTMLElement>(null);
  const selectedAccountId = detail?.account.id;
  useEffect(() => { if (selectedAccountId) { selectedAccount.current?.focus({ preventScroll:true }); selectedAccount.current?.scrollIntoView({ block:'start' }); } }, [selectedAccountId]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rolloutDirty, setRolloutDirty] = useState(false);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void getCorporateAccountDetail(accountId).then(result => { if (active) setDetail(result); }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Account could not be opened.'); });
    return () => { active = false; };
  }, [accountId]);
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
  return <div className={[management.workspace,ui.workspace].join(' ')}>
    <div><h1 className={styles.pageTitle}>Corporate accounts</h1><p className={styles.pageDescription}>Review business registrations, manage approvals and view company contact details.</p></div>
    <nav className={ui.tabs} aria-label="Corporate administration">{[['accounts','Account approvals'],['rollout','Access settings']].map(([key, title]) => <button key={key} disabled={busy} aria-pressed={key === tab} onClick={() => switchTab(key)}>{title}</button>)}</nav>
    {error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={ui.notice} role="status">{message}</p>}
    {tab === 'accounts' && <>
      <section className={styles.card}><form role="search" className={management.filters} onSubmit={event => { event.preventDefault(); if (confirmDiscard()) { setReason(''); setDetail(null); setPage(1); void reload(); } }}>
        <label>Search company / main contact<input className={styles.input} type="search" maxLength={180} value={query} disabled={busy || Boolean(reason)} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        <label>Account status<select className={styles.select} value={status} disabled={busy || Boolean(reason)} onChange={event => { setStatus(event.target.value as CorporateAccountStatus | ''); setPage(1); }}><option value="">All statuses</option>{['Awaiting approval','Approved','Rejected'].map(value => <option key={value}>{value}</option>)}</select></label>
        <button className={styles.secondaryButton} disabled={busy}>Refresh</button>
      </form><FeatureState loading={loading} error={loadError} retry={() => void reload()} />
      {!loading && !loadError && <><div className={[management.tableViewport,ui.responsiveTable].join(' ')}><table role="table" aria-label="Corporate accounts" className={styles.table}><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Company</th><th role="columnheader" scope="col">Main contact</th><th role="columnheader" scope="col">Contact details</th><th role="columnheader" scope="col">Status / verification</th><th role="columnheader" scope="col">Actions</th></tr></thead><tbody role="rowgroup">{data?.rows.map(account => <tr role="row" key={account.id}><td role="cell" data-label="Company">{account.company_name}</td><td role="cell" data-label="Main contact">{account.contact_name}</td><td role="cell" data-label="Contact details">{account.contact_email}<br />{account.contact_phone}</td><td role="cell" data-label="Status / verification"><span className={ui.badge} data-status={account.status}>{account.status}</span><br />{account.email_verified ? 'Email verified' : 'Email not verified'}</td><td role="cell" data-label="Actions"><button className={styles.secondaryButton} disabled={busy} onClick={() => openFromButton(account.id)}>Review account</button></td></tr>)}{!data?.rows.length && <tr role="row"><td role="cell" colSpan={5}>No matching corporate accounts.</td></tr>}</tbody></table></div>
      {((data?.total ?? 0) > 10 || page > 1) && <nav className={ui.pagination} aria-label="Account pages"><button className={styles.secondaryButton} disabled={page === 1 || busy || Boolean(reason)} onClick={() => setPage(page - 1)}>Previous</button><span>{data?.total ?? 0} accounts · Page {page}</span><button className={styles.secondaryButton} disabled={page * 10 >= (data?.total ?? 0) || busy || Boolean(reason)} onClick={() => setPage(page + 1)}>Next</button></nav>}</>}
      </section>
      {detail && <section ref={selectedAccount} tabIndex={-1} aria-label="Selected company account" className={`${styles.card} ${ui.body} ${ui.focusTarget}`}><div className={ui.sectionHeader}><h2>{detail.account.company_name}</h2><span className={ui.badge} data-status={detail.account.status}>{detail.account.status}</span></div><dl className={management.profile}><div><dt>Main contact</dt><dd>{detail.account.contact_name}</dd></div><div><dt>Email</dt><dd>{detail.account.contact_email}</dd></div><div><dt>Phone</dt><dd>{detail.account.contact_phone}</dd></div><div><dt>Billing address</dt><dd>{detail.account.billing_address}</dd></div><div><dt>Login email verification</dt><dd>{detail.email_verified ? 'Verified' : 'Not verified — approval is blocked'}</dd></div><div><dt>Latest review</dt><dd>{detail.account.review_reason || 'Not reviewed'}</dd></div></dl>
        {detail.account.status !== 'Approved' && <div><label className={styles.field}><span className={styles.fieldLabel}>Decision / external follow-up reason</span><textarea className={styles.input} style={{ minHeight: 80, paddingTop: 12 }} required maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label><div className={styles.formActions}>{detail.account.status === 'Rejected' ? <button className={styles.primaryButton} disabled={busy || !reason.trim()} onClick={() => void decide('reconsider')}>Reconsider existing account</button> : <><button className={styles.primaryButton} disabled={busy || !reason.trim() || !detail.email_verified} onClick={() => void decide('approve')}>Approve account</button><button className={styles.dangerButton} disabled={busy || !reason.trim()} onClick={() => void decide('reject')}>Reject account</button></>}</div></div>}
        <ContactOptions email={detail.account.contact_email} phone={detail.account.contact_phone} label="Contact company" />
        <AccountHistory rows={detail.history} />
      </section>}
    </>}
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
  }}><fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Access controls</legend><label className={management.preference}><input type="checkbox" checked={registration} onChange={event => { setRegistration(event.target.checked); dirtyChanged(event.target.checked !== initial.registration_enabled || phone !== initial.volunteer_phone_required); }} />Open business account registration</label><label className={management.preference}><input type="checkbox" checked={phone} onChange={event => { setPhone(event.target.checked); dirtyChanged(registration !== initial.registration_enabled || event.target.checked !== initial.volunteer_phone_required); }} />Require a saved cellphone for new volunteer bookings</label><p className={ui.notice}>Before opening registration, verify that Supabase email confirmation, allowed redirect URLs, recovery links and email delivery work on this deployment. No operational payment emails are sent by this phase.</p>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}<div className={ui.formFooter}><button type="submit" className={styles.primaryButton}>Save rollout controls</button></div></fieldset></form>;
}
