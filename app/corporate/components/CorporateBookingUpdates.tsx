"use client";

import { useCallback, useState } from 'react';
import { getCorporateBookingNotices } from '@/lib/actions/corporate-bookings';
import { readCorporateAccountNotice } from '@/lib/actions/corporate-accounts';
import { corporateDateLabel } from '@/lib/corporate-booking-utils';
import { useFeatureData, FeatureState } from '@/app/admin/components/FeatureShared';
import { WorkflowPagination } from './CorporateWorkflowShared';
import styles from '@/app/admin/admin.module.css';
import ui from '../corporate.module.css';

export default function CorporateBookingUpdates({ goToBooking }: { goToBooking: (id: string) => Promise<void> }) {
  const [page, setPage] = useState(1), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const loader = useCallback(() => getCorporateBookingNotices(page), [page]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  return <section className={`${styles.card} ${ui.body}`}><h1 className={styles.pageTitle}>Booking updates</h1><p>Account approval updates remain in your business profile. These updates open the exact booking concerned.</p><FeatureState loading={loading} error={loadError} retry={() => void reload()} />{error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !loadError && <>{data?.rows.map(notice => <article key={notice.id} className={ui.notice}><strong>{notice.title}</strong>{!notice.is_read && <span className={ui.badge}>Unread</span>}<p>{notice.message}</p><time dateTime={notice.created_at}>{corporateDateLabel(notice.created_at)}</time><div><button className={styles.secondaryButton} disabled={Boolean(busy)} onClick={async () => {
      if (busy) return; setBusy(notice.id); setError('');
      try { await goToBooking(notice.booking_id); await readCorporateAccountNotice(notice.id); void reload(); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open this booking update.'); }
      finally { setBusy(''); }
    }}>{busy === notice.id ? 'Opening…' : 'Go to booking'}</button></div></article>)}{!data?.rows.length && <p>No booking updates on this page.</p>}<WorkflowPagination page={page} total={data?.total ?? 0} change={setPage} disabled={Boolean(busy)} /></>}
  </section>;
}
