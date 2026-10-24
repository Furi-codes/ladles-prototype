import type { CorporateAccountHistory } from '@/lib/corporate-account-types';
import ui from '../corporate.module.css';

export default function AccountHistory({ rows }: { rows: CorporateAccountHistory[] }) {
  return <section className={ui.historySection}><h2>Account activity</h2><p>Account reviews and profile updates, shown in South African time.</p>{rows.length ? <ol className={ui.history}>{rows.map(row => <li key={row.id}><strong>{row.action}</strong><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} · {row.actor_name}</time>{row.reason && <p>{row.reason}</p>}</li>)}</ol> : <p className={ui.emptyState}>No account activity recorded yet.</p>}</section>;
}
