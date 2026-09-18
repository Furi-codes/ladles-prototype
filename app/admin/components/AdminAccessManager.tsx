"use client";
import { useEffect, useRef, useState } from 'react';
import { changeAdminAccess, currentAccessUserId, searchAccessProfiles } from '@/lib/actions/access';
import type { Profile, UserRole } from '@/lib/types';
import { Field } from './FeatureShared';
import styles from '../admin.module.css';

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
    currentAccessUserId().then(id => { if (active) setUserId(id); }).catch(e => { if (active) setMessage(e.message); });
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
        if (active && version === searchVersion.current) { setResults([]); setAvailable(false); setMessage(e instanceof Error ? e.message : 'Search failed.'); }
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
      setPending(null);
      setResults([]);
      await reload();
      setMessage('Administrator access updated.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to change access.'); }
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
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Name</th><th>Email</th><th>Access</th></tr></thead><tbody>{admins.map(profile => <tr key={profile.id}><td>{profile.full_name}</td><td>{profile.email}</td><td>{action(profile)}</td></tr>)}</tbody></table></div>
      <Field label="Search existing users by name or email"><input type="search" maxLength={200} className={styles.input} value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setResults([]); setSearching(true); setPending(null); }} /></Field>
      {searching && <p role="status" className={styles.helper}>Checking access / searching…</p>}
      {available && !searching && <p className={styles.helper}>{query.trim().length < 2 ? 'Enter at least two characters to search existing profiles.' : results.length ? 'Up to 10 matching profiles. Refine your search if needed.' : 'No matching profiles.'}</p>}
      {!!results.length && <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Name</th><th>Email</th><th>Current role</th><th>Change access</th></tr></thead><tbody>{results.map(profile => <tr key={profile.id}><td>{profile.full_name}</td><td>{profile.email}</td><td>{profile.role}</td><td>{action(profile)}</td></tr>)}</tbody></table></div>}
      {pending && <div className={styles.featureStack} role="group" aria-label="Confirm access change"><p>{pending.role === 'admin' ? 'Grant administrator access to' : 'Revoke administrator access from'} <strong>{pending.profile.full_name} ({pending.profile.email})</strong>?</p><button type="button" className={styles.primaryButton} disabled={busy} onClick={confirm}>{busy ? 'Updating…' : 'Confirm access change'}</button><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setPending(null)}>Cancel</button></div>}
    </div>
  </section>;
}
