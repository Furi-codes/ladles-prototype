"use client";
import Link from 'next/link';
import { loadReportData } from '@/lib/actions/corporate';
import { performanceRows, presetFilter } from '@/lib/reporting';
import { FeatureState, useFeatureData } from './FeatureShared';
import styles from '../admin.module.css';

const loadRecentActivity = () => loadReportData(presetFilter('Recent Activity'));

export default function DashboardAnalytics() {
  const { data, error, loading, reload } = useFeatureData(loadRecentActivity);
  const filter = presetFilter('Recent Activity');
  const rows = data ? performanceRows(data.events, data.slots, data.bookings, data.attendance, data.corporate, filter) : [];
  const total = (key: 'attendance' | 'individualHours' | 'corporateHours' | 'groups') => rows.reduce((sum, row) => sum + row[key], 0);
  return <section className={styles.card} aria-labelledby="dashboard-analytics">
    <div className={styles.cardHeader}><div><h2 id="dashboard-analytics" className={styles.cardTitle}>Recent activity</h2><p className={styles.cardHint}>Event activity over the last 30 days · {filter.from} to {filter.to}</p></div><Link href="/admin/reports" className={styles.secondaryButton}>View Full Reports</Link></div>
    <div className={styles.featureBody}><FeatureState loading={loading} error={error} retry={reload} />
      {data && !loading && <><div className={styles.stats}>{[
        ['Recorded attendees', total('attendance')], ['Verified individual hours', total('individualHours').toFixed(2)],
        ['Recorded corporate hours', total('corporateHours').toFixed(2)], ['Corporate groups', total('groups')],
      ].map(([label, value]) => <div key={label}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div></div>)}</div>
      <p className={styles.helper}>{rows.length} events in this period. Attendance counts recorded individual clock-ins and completed corporate attendance. Corporate places are participation instances, not unique people.</p></>}
    </div>
  </section>;
}
