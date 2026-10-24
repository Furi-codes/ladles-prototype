"use client";

import { useCallback, useState } from 'react';
import { loadCorporateAccountNotices, readCorporateAccountNotice } from '@/lib/actions/corporate-accounts';
import { FeatureState, useFeatureData } from '@/app/admin/components/FeatureShared';
import styles from '@/app/admin/admin.module.css';
import ui from '../corporate.module.css';

/** An account notification opens its actual account record, not just a read/unread flag. */
export default function AccountNotices({ goToAccount }: { goToAccount: (id: string) => Promise<void> }) {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const loader = useCallback(() => loadCorporateAccountNotices(page), [page]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  async function open(id: string, accountId: string) {
    if (busyId) return; setBusyId(id); setError('');
    try {
      // Destination access is checked again; don't claim navigation success when the target is unavailable.
      await goToAccount(accountId); await readCorporateAccountNotice(id); void reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open this update.'); }
    finally { setBusyId(''); }
  }
  return <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Account notifications</h2><p className={styles.cardHint}>Approval decisions and account updates. Read messages stay here for reference.</p></div></div><FeatureState loading={loading} error={loadError} retry={() => void reload()} />{error && <p className={styles.error} role="alert">{error}</p>}{!loading && !loadError && <>
    <div className={ui.notificationList}>{data?.rows.map(row => <article className={ui.notificationItem} key={row.id}><div className={ui.notificationHeading}><strong>{row.title}</strong>{!row.is_read && <span className={ui.badge}>Unread</span>}</div><p>{row.message}</p><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</time><div><button className={styles.secondaryButton} disabled={Boolean(busyId)} onClick={() => void open(row.id, row.account_id)}>{busyId === row.id ? 'Opening…' : 'Go to account'}</button></div></article>)}</div>
    {!data?.rows.length && <p className={ui.empty}>No account notifications on this page.</p>}
    {((data?.total ?? 0) > 10 || page > 1) && <div className={ui.pagination}><button className={styles.secondaryButton} disabled={page === 1 || Boolean(busyId)} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {data?.total ?? 0} updates</span><button className={styles.secondaryButton} disabled={page * 10 >= (data?.total ?? 0) || Boolean(busyId)} onClick={() => setPage(page + 1)}>Next</button></div>}
  </>}</section>;
}
