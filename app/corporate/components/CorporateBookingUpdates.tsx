"use client";

import { useCallback, useRef, useState } from 'react';
import { getCorporateBookingNotices } from '@/lib/actions/corporate-bookings';
import { markAllCorporateNoticesRead, readCorporateAccountNotice } from '@/lib/actions/corporate-accounts';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { corporateNoticesChanged } from '@/lib/corporate-notifications';
import { corporateNoticeCopy } from '@/lib/corporate-notice-copy';
import { FeatureState } from '@/app/admin/components/FeatureShared';
import { useCorporateFeatureData as useFeatureData } from './useCorporateFeatureData';
import { WorkflowPagination } from './CorporateWorkflowShared';
import styles from '@/app/admin/admin.module.css';
import ui from '../corporate.module.css';

export default function CorporateBookingUpdates({ goToBooking, admin = false }: { goToBooking: (id: string) => Promise<void>; admin?: boolean }) {
  const [page, setPage] = useState(1), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const loader = useCallback(() => getCorporateBookingNotices(page), [page]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  async function markAll() {
    if (pending.current) return; pending.current=true; setBusy('all'); setError(''); setMessage('');
    try {
      await markAllCorporateNoticesRead();
      window.dispatchEvent(new Event(corporateNoticesChanged));
      setMessage('All notifications marked as read.'); setPage(1); await reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Notifications could not be marked read. Please retry.'); }
    finally { pending.current=false; setBusy(''); }
  }
  return <div className={ui.workspace}><div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>{admin ? 'Booking updates' : 'Notifications'}</h1><p className={styles.pageDescription}>Your booking updates, all in one place.</p></div></div><section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Recent updates</h2></div><button type="button" className={styles.secondaryButton} title="Marks notifications on every page as read" disabled={loading || Boolean(loadError) || Boolean(busy) || !data?.total} onClick={() => void markAll()}>{busy === 'all' ? 'Marking as read…' : 'Mark all as read'}</button></div><FeatureState loading={loading} error={loadError} retry={() => void reload()} />{error && <p className={styles.error} role="alert">{error}</p>}{message && <p className={ui.body} role="status">{message}</p>}
    {!loading && !loadError && <><div className={ui.notificationList}>{data?.rows.map(notice => {
      const copy = corporateNoticeCopy(notice);
      return <article key={notice.id} className={ui.notificationItem}><div className={ui.notificationHeading}><strong>{copy.title}</strong>{!notice.is_read && <span className={ui.badge}>Unread</span>}</div>{copy.summary && <p>{copy.summary}</p>}{copy.note && <p className={ui.notificationNote}>{copy.summary ? <><strong>{copy.noteLabel}:</strong> </> : null}{copy.note}</p>}<div className={ui.notificationMeta}><span>Booking #{notice.booking_id.slice(0, 8).toUpperCase()}</span><time dateTime={notice.created_at}>{corporateDateLabel(notice.created_at)}</time></div><div><button className={styles.secondaryButton} disabled={Boolean(busy)} onClick={async () => {
      if (pending.current) return; pending.current=true; setBusy(notice.id); setError(''); setMessage('');
      try {
        await goToBooking(notice.booking_id); await readCorporateAccountNotice(notice.id);
        if (typeof window !== 'undefined') window.dispatchEvent(new Event(corporateNoticesChanged));
        void reload();
      }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open this booking update.'); }
      finally { pending.current=false; setBusy(''); }
    }}>{busy === notice.id ? 'Opening…' : 'Go to booking'}</button></div></article>;
    })}</div>{!data?.rows.length && <p className={ui.empty}>No notifications yet.</p>}{((data?.total ?? 0) > 10 || page > 1) && <WorkflowPagination page={page} total={data?.total ?? 0} change={setPage} disabled={Boolean(busy)} />}</>}
    <p className={ui.notificationFooter}>In-app updates only · Booking emails are not sent.</p>
  </section></div>;
}
