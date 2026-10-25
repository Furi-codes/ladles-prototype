/**
 * Displays the readable history of a business account.
 * Stored history is formatted for the user rather than printing raw database snapshots.
 */

import type { CorporateAccountHistory } from '@/features/corporate/types/accounts';
import ui from '@/styles/corporate.module.css';

export default function AccountHistory({ rows }: { rows: CorporateAccountHistory[] }) {
  return <section className={ui.historySection}><h2>Account activity</h2><p>Account reviews and profile updates, shown in South African time.</p>{rows.length ? <ol className={ui.history}>{rows.map(row => <li key={row.id}><strong>{row.action}</strong><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} · {row.actor_name}</time>{row.reason && <p>{row.reason}</p>}</li>)}</ol> : <p className={ui.emptyState}>No account activity recorded yet.</p>}</section>;
}
