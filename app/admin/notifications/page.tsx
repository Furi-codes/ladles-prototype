"use client";
import { userFacingError } from '@/lib/user-facing-error';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { corporateRolloutEnabled } from '@/lib/feature-flags';
import { adminNoticesChanged, loadAdminNotices, openAdminNotice, type AdminNotice, type AdminNoticeKind } from '@/lib/admin-notifications';
import { markAllCorporateNoticesRead, readCorporateAccountNotice } from '@/lib/actions/corporate-accounts';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { useAdminNoticeData } from '../components/useAdminNoticeData';
import { FeatureState } from '../components/FeatureShared';
import { WorkflowPagination } from '@/app/corporate/components/CorporateWorkflowShared';
import styles from '../admin.module.css';
import management from '../components/management.module.css';
import ui from '@/app/corporate/corporate.module.css';

export default function AdminNotificationsPage() {
  if (!corporateRolloutEnabled) return <p>Corporate notifications are not enabled.</p>;
  return <AdminInbox />;
}
function AdminInbox() {
  const router = useRouter();
  const [kind, setKind] = useState<AdminNoticeKind>(''), [unread, setUnread] = useState(false), [page, setPage] = useState(1);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const loader = useCallback(() => loadAdminNotices(kind, unread, page), [kind, unread, page]);
  const { data, loading, error: loadError, reload } = useAdminNoticeData(loader);
  async function markAll() {
    if (pending.current) return; pending.current=true; setBusy('all'); setError(''); setMessage('');
    try {
      await markAllCorporateNoticesRead();
      window.dispatchEvent(new Event(adminNoticesChanged));
      setMessage('All existing notifications have been marked as read.'); setPage(1); await reload();
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Notifications could not be marked read. Please retry.', "Notifications could not be marked read. Please retry.")); }
    finally { pending.current=false; setBusy(''); }
  }
  async function act(notice: AdminNotice, open: boolean) {
    if (pending.current) return; pending.current=true; setBusy(notice.id); setError(''); setMessage('');
    try {
      if (open) await openAdminNotice(notice, path => router.push(path));
      else { await readCorporateAccountNotice(notice.id); window.dispatchEvent(new Event(adminNoticesChanged)); }
      await reload();
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Notification could not be opened. Please retry.', "Notification could not be opened. Please retry.")); }
    finally { pending.current=false; setBusy(''); }
  }
  return <div className={[management.workspace,ui.workspace].join(' ')}><div><h1 className={styles.pageTitle}>Admin notifications</h1><p className={styles.pageDescription}>Corporate account and booking updates in one inbox. Read status is personal to each administrator.</p></div>
    <section className={styles.card}><div className={management.filters}><label>Updates<select className={styles.select} value={kind} disabled={Boolean(busy)} onChange={event => { setKind(event.target.value as AdminNoticeKind); setPage(1); }}><option value="">All updates</option><option value="account">Account updates</option><option value="booking">Booking updates</option></select></label><label className={management.checkboxFilter}><input type="checkbox" checked={unread} disabled={Boolean(busy)} onChange={event => { setUnread(event.target.checked); setPage(1); }} />Unread only</label><button className={styles.secondaryButton} disabled={loading || Boolean(busy)} onClick={() => void reload()}>Refresh</button><button type="button" className={styles.secondaryButton} disabled={loading || Boolean(loadError) || Boolean(busy) || !data?.unread_total} title="Includes all pages and update types, regardless of the current filters" onClick={() => void markAll()}>{busy === 'all' ? 'Marking as read…' : 'Mark all as read'}</button></div>
      <FeatureState loading={loading} error={loadError} retry={() => void reload()} />{error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={ui.body} role="status">{message}</p>}
      {!loading && !loadError && data && <><p className={ui.body} role="status">{data.unread_total} unread across all updates · {data.total} matching updates</p><div className={ui.notificationList}>{data.rows.map(notice => <article key={notice.id} className={ui.notificationItem}><div className={ui.notificationHeading}><strong>{notice.title}</strong>{!notice.is_read && <span className={ui.badge}>Unread</span>}</div><p>{notice.company_name} · {notice.target_kind==='account' ? 'Account' : 'Booking'}</p><p>{notice.message}</p><time dateTime={notice.created_at}>{corporateDateLabel(notice.created_at)}</time><div className={ui.actions}><button className={styles.primaryButton} disabled={Boolean(busy)} onClick={() => void act(notice, true)}>{busy===notice.id ? 'Please wait…' : notice.attendance_due ? notice.attendance_blocked ? 'Review attendance' : 'Record attendance' : notice.target_kind==='account' ? 'Go to account' : 'Go to booking'}</button>{!notice.is_read && <button className={styles.secondaryButton} disabled={Boolean(busy)} onClick={() => void act(notice, false)}>Mark as read</button>}</div></article>)}</div>{!data.rows.length && <p className={ui.empty}>No matching notifications.</p>}<WorkflowPagination page={page} total={data.total} disabled={Boolean(busy)} change={setPage} /></>}
    </section></div>;
}
