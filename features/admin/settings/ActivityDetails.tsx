/**
 * Shows the readable fields available for an admin or WMS activity entry.
 * The formatter selects known fields instead of exposing the raw stored object.
 */

import { activityDetails } from '@/features/admin/utils/activity';
import styles from '@/components/ui/management.module.css';

export default function ActivityDetails({ details }: { details: unknown }) {
  const rows = activityDetails(details);
  if (!rows.length) return null;
  return <details className={styles.activityDetails}><summary>View details</summary><dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>;
}
