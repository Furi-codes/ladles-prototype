import type { CorporateAccountHistory } from '@/lib/corporate-account-types';
import ui from '../corporate.module.css';

export default function AccountHistory({ rows }: { rows: CorporateAccountHistory[] }) {
  return <section><h2>Latest account actions</h2><p>The latest 50 recorded actions, shown in South African time.</p><ol className={ui.history}>{rows.map(row => <li key={row.id}><strong>{row.action}</strong><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} · {row.actor_name}</time><p>{row.reason}</p></li>)}</ol></section>;
}
