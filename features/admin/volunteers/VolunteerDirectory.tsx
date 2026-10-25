"use client";
/**
 * Lets administrators search volunteer profiles and view their contact details.
 * The directory uses a protected paged query, including volunteers who do not have a booking.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { corporateRolloutEnabled } from '@/lib/config/features';
import { searchVolunteerDirectory } from '@/features/corporate/services/accounts';
import type { VolunteerDirectoryItem } from '@/features/corporate/types/accounts';
import ContactOptions from '@/components/contacts/ContactOptions';
import { FeatureState, useFeatureData } from '@/components/ui/FeatureShared';
import styles from '@/styles/admin.module.css';
import ui from '@/components/ui/management.module.css';

export default function VolunteerDirectoryPage() {
  if (!corporateRolloutEnabled) return <p>The volunteer directory rollout is not enabled yet.</p>;
  return <VolunteerDirectory />;
}
function ContactLinks({ person }: { person: VolunteerDirectoryItem }) {
  return <ContactOptions email={person.email} phone={person.phone} phoneLabel="Cellphone" label="Contact volunteer" />;
}
function VolunteerDirectory() {
  const [query, setQuery] = useState('');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<VolunteerDirectoryItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const loader = useCallback(() => searchVolunteerDirectory(query, phone, page), [query, phone, page]);
  const { data, loading, error, reload } = useFeatureData(loader);
  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [selected]);
  return <><div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Volunteer directory</h1><p className={styles.pageDescription}>All volunteer profiles, including people with no bookings. Contact details are restricted to administrators.</p></div></div><section className={styles.card}>
    <div className={ui.filters}><label>Search name, email or phone<input className={styles.input} type="search" maxLength={180} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><label>Cellphone<select className={styles.select} value={phone} onChange={event => { setPhone(event.target.value); setPage(1); }}><option value="">All volunteers</option><option value="missing">Number missing</option><option value="provided">Number provided</option></select></label><button className={styles.secondaryButton} onClick={() => { setQuery(''); setPhone(''); setPage(1); }}>Clear filters</button></div>
    <FeatureState loading={loading} error={error} retry={() => void reload()} />
    {!loading && !error && <><p className={ui.count} role="status">{data?.total ?? 0} volunteers · Page {page}</p><div className={ui.tableViewport}><table className={styles.table}><thead><tr><th>Volunteer</th><th>Email</th><th>Cellphone</th><th>Booking records</th><th>Contact / details</th></tr></thead><tbody>{data?.rows.map(person => <tr key={person.id}><td>{person.full_name}</td><td>{person.email || 'Not provided'}</td><td>{person.phone || 'Number needed'}</td><td>{person.booking_count}</td><td><ContactLinks person={person} /><button className={styles.secondaryButton} onClick={() => setSelected(person)}>View details</button></td></tr>)}{!data?.rows.length && <tr><td colSpan={5}>No matching volunteers.</td></tr>}</tbody></table></div>{((data?.total ?? 0) > 10 || page > 1) && <div className={ui.filters}><button className={styles.secondaryButton} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className={styles.secondaryButton} disabled={page * 10 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</button></div>}</>}
  </section>{selected && <dialog ref={dialog} className={styles.dialog} aria-labelledby="directory-person" onCancel={() => setSelected(null)} onClose={() => setSelected(null)}><h2 id="directory-person">{selected.full_name}</h2><dl className={ui.profile}><div><dt>Email</dt><dd>{selected.email || 'Not provided'}</dd></div><div><dt>Cellphone</dt><dd>{selected.phone || 'Not provided'}</dd></div><div><dt>Date of birth</dt><dd>{selected.date_of_birth || 'Not provided'}</dd></div><div><dt>Booking records</dt><dd>{selected.booking_count}</dd></div></dl><ContactLinks person={selected} /><div className={styles.formActions}><button className={styles.secondaryButton} autoFocus onClick={() => dialog.current?.close()}>Close details</button></div></dialog>}</>;
}
