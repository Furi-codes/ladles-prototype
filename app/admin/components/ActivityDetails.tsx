import { activityDetails } from '@/lib/admin-activity';
import styles from './management.module.css';

export default function ActivityDetails({ details }: { details: unknown }) {
  const rows = activityDetails(details);
  if (!rows.length) return null;
  return <details className={styles.activityDetails}><summary>View details</summary><dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>;
}
