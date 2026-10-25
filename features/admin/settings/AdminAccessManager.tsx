"use client";
/**
 * Searches profiles and lets an administrator review an access change.
 * The confirmation screen is separate from the write, and the protected RPC checks permission
 * again.
 */

import { userFacingError } from '@/lib/errors/user-facing';
import { useEffect, useRef, useState } from 'react';
import { changeAdminAccess, currentAccessUserId, searchAccessProfiles } from '@/features/admin/services/access';
import { logAdminAction } from '@/features/admin/services/audit';
import type { Profile, UserRole } from '@/lib/types';
import { Field } from '@/components/ui/FeatureShared';
import styles from '@/styles/admin.module.css';

export default function AdminAccessManager({ admins, reload }: { admins: Profile[]; reload: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(true);
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState<{ profile: Profile; role: UserRole } | null>(null);
  const searchVersion = useRef(0);
  useEffect(() => {
    let active = true;
    currentAccessUserId().then(id => { if (active) setUserId(id); }).catch(e => { if (active) setMessage(userFacingError(e.message, "This action could not be completed. Please refresh and try again.")); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const version = ++searchVersion.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const profiles = await searchAccessProfiles(query);
        if (active && version === searchVersion.current) { setResults(profiles); setAvailable(true); setMessage(''); }
      } catch (e) {
        if (active && version === searchVersion.current) { setResults([]); setAvailable(false); setMessage(userFacingError(e instanceof Error ? e.message : 'Search failed.', "Search failed.")); }
      } finally { if (active && version === searchVersion.current) setSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  async function confirm() {
    if (!pending) return;
    setBusy(true); setMessage('');
    searchVersion.current++;
    try {
      await changeAdminAccess(pending.profile.id, pending.role);
      await logAdminAction({
        action: pending.role === 'admin' ? 'ADMIN_ACCESS_GRANTED' : 'ADMIN_ACCESS_REVOKED',
        entityType: 'PROFILE',
        entityId: pending.profile.id,
        entityLabel: pending.profile.full_name,
        details: { role: pending.role },
      });
      setPending(null);
      setResults([]);
      await reload();
      setMessage('Administrator access updated.');
    } catch (e) { setMessage(userFacingError(e instanceof Error ? e.message : 'Unable to change access.', "Unable to change access.")); }
    finally { setBusy(false); setSearching(false); }
  }
  function action(profile: Profile) {
    const revoke = profile.role === 'admin';
    const self = profile.id === userId;
    return <button type="button" className={styles.secondaryButton} disabled={busy || !available || !userId || self || (revoke && admins.length <= 1)} onClick={() => setPending({ profile, role: revoke ? 'volunteer' : 'admin' })}>{self ? 'Your account' : revoke ? 'Revoke admin' : 'Grant admin'}</button>;
  }
  return <section className={styles.card}>
    <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Administrators / Access</h2></div>
    <div className={styles.featureBody}>
      {message && <p role="status" className={styles.helper}>{message}</p>}
      <p className={styles.helper}>You cannot revoke your own access or remove the final administrator.</p>
      <div data-mobile-table className={styles.tableWrap}><table role="table" className={styles.table}><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Name</th><th role="columnheader" scope="col">Email</th><th role="columnheader" scope="col">Access</th></tr></thead><tbody role="rowgroup">{admins.map(profile => <tr role="row" key={profile.id}><td role="cell" data-label="Name">{profile.full_name}</td><td role="cell" data-label="Email">{profile.email}</td><td role="cell" data-label="Actions">{action(profile)}</td></tr>)}</tbody></table></div>
      <Field label="Search existing users by name or email"><input type="search" maxLength={200} className={styles.input} value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setResults([]); setSearching(true); setPending(null); }} /></Field>
      {searching && <p role="status" className={styles.helper}>Checking access / searching…</p>}
      {available && !searching && <p className={styles.helper}>{query.trim().length < 2 ? 'Enter at least two characters to search existing profiles.' : results.length ? 'Up to 10 matching profiles. Refine your search if needed.' : 'No matching profiles.'}</p>}
      {!!results.length && <div data-mobile-table className={styles.tableWrap}><table role="table" className={styles.table}><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Name</th><th role="columnheader" scope="col">Email</th><th role="columnheader" scope="col">Current role</th><th role="columnheader" scope="col">Change access</th></tr></thead><tbody role="rowgroup">{results.map(profile => <tr role="row" key={profile.id}><td role="cell" data-label="Name">{profile.full_name}</td><td role="cell" data-label="Email">{profile.email}</td><td role="cell" data-label="Current role">{profile.role}</td><td role="cell" data-label="Actions">{action(profile)}</td></tr>)}</tbody></table></div>}
      {pending && <div className={styles.featureStack} role="group" aria-label="Confirm access change"><p>{pending.role === 'admin' ? 'Grant administrator access to' : 'Revoke administrator access from'} <strong>{pending.profile.full_name} ({pending.profile.email})</strong>?</p><button type="button" className={styles.primaryButton} disabled={busy} onClick={confirm}>{busy ? 'Updating…' : 'Confirm access change'}</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setPending(null)}>Cancel</button></div>}
    </div>
  </section>;
}
