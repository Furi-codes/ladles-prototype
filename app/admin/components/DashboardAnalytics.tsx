"use client";
import Link from 'next/link';
import { loadReportData } from '@/lib/actions/corporate';
import { reportAnalytics, dateRangeFilter } from '@/lib/reporting';
import { FeatureState, useFeatureData } from './FeatureShared';
import styles from '../admin.module.css';
import { ReportSummary, MonthlyChart } from './ReportCharts';
import chartStyles from './Reports.module.css';

const loadRecentActivity = async () => {
  const filter = dateRangeFilter('Last 30 days');
  return { filter, report: reportAnalytics(await loadReportData(filter), filter) };
};

export default function DashboardAnalytics() {
  const { data, error, loading, reload } = useFeatureData(loadRecentActivity);
  return <section className={`${styles.card} ${chartStyles.preview}`} aria-labelledby="dashboard-analytics">
    <div className={styles.cardHeader}><div><h2 id="dashboard-analytics" className={`${styles.cardTitle} ${styles.dashboardCardTitle}`}>Recent activity</h2><p className={styles.cardHint}>Event activity over the last 30 days · {data?.filter.from} to {data?.filter.to}</p></div><Link href="/admin/reports" className={styles.secondaryButton}>View Full Reports</Link></div>
    <div className={styles.featureBody}><FeatureState loading={loading} error={error} retry={reload} />
      {data && !loading && !error && <div className={chartStyles.root}><ReportSummary report={data.report} /><MonthlyChart report={data.report} /></div>}
    </div>
  </section>;
}
