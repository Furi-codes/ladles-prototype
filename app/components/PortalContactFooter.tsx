"use client";

import { useCallback, useEffect } from 'react';
import { getPortalContacts } from '@/lib/actions/portal-contacts';
import { portalContactsChanged, type ContactPortal } from '@/lib/portal-contacts';
import { useFeatureData } from '@/app/admin/components/FeatureShared';
import ContactOptions from './ContactOptions';
import styles from '@/app/volunteer/volunteer.module.css';
import css from './portal-contacts.module.css';

/** Shared placement, separate approved contacts. Details open locally; external apps
 * launch only when the user explicitly chooses an email or call action. */
export default function PortalContactFooter({ portal }: { portal: ContactPortal }) {
  const loader = useCallback(() => getPortalContacts(portal), [portal]);
  const { data, loading, error, reload } = useFeatureData(loader);
  useEffect(() => {
    const refresh = () => { void reload(); };
    window.addEventListener('focus', refresh); window.addEventListener(portalContactsChanged, refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener(portalContactsChanged, refresh); };
  }, [reload]);
  if (error) return <footer className={css.footer}><div className={css.feedback}><p role="status">Contact team details are temporarily unavailable.</p><button className={styles.secondaryButton} type="button" disabled={loading} onClick={() => void reload()}>Retry</button></div></footer>;
  // No invented contacts, empty cards or a control that opens nothing.
  if (!data || data.portal !== portal || !data.contacts.length) return null;
  const contacts = [...data.contacts].sort((a,b) => Number(b.is_primary)-Number(a.is_primary));
  return <footer className={css.footer}><details onToggle={event => { if (event.currentTarget.open) void reload(); }}><summary className={styles.secondaryButton}>Contact team</summary><div className={css.panel}>
    <h2>{portal === 'corporate' ? 'Corporate booking support' : 'Volunteer support'}</h2>
    {contacts.map(contact => <section className={css.contact} key={contact.kind+':'+contact.value}>
      <h3>{contact.label}{contact.is_primary && <span>Primary {contact.kind === 'email' ? 'email' : 'phone'}</span>}</h3>
      <ContactOptions expanded email={contact.kind === 'email' ? contact.value : null} phone={contact.kind === 'phone' ? contact.value : null} buttonClassName={styles.secondaryButton} />
    </section>)}
  </div></details></footer>;
}
