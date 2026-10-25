"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPortalContacts } from '@/lib/actions/portal-contacts';
import { portalContactsChanged, type ContactPortal } from '@/lib/portal-contacts';
import { useFeatureData } from '@/app/admin/components/FeatureShared';
import { useDialogFocus } from './useDialogFocus';
import ContactOptions from './ContactOptions';
import styles from '@/app/volunteer/volunteer.module.css';
import css from './portal-contacts.module.css';

/** One header shortcut per portal. Contact details stay separate from email/call app actions. */
export default function PortalContactButton({ portal }: { portal: ContactPortal }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const loader = useCallback(() => getPortalContacts(portal), [portal]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const titleId = `portal-contact-${portal}`;
  useDialogFocus(open, panel, () => setOpen(false));

  useEffect(() => {
    const refresh = () => { void reload(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(portalContactsChanged, refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(portalContactsChanged, refresh);
    };
  }, [reload]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  // Never show cached details for the other portal or an empty shortcut before contacts exist.
  const contacts = data?.portal === portal ? [...data.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)) : [];
  if (!open && !error && !contacts.length) return null;

  return <>
    <button type="button" className={css.trigger} aria-label="Contact team" title="Contact team" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(true); void reload(); }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /><path d="M8 12h8M8 8h5" /></svg>
      <span>Contact team</span>
    </button>
    {/* Render outside the sticky header so its backdrop/filter cannot clip or position the dialog. */}
    {open && createPortal(<div className={`portalUi ${css.overlay}`} role="presentation" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={panel} tabIndex={-1} className={css.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={css.dialogHeader}>
          <div><h2 id={titleId}>{portal === 'corporate' ? 'Corporate booking support' : 'Volunteer support'}</h2><p>Get in touch with the Ladles of Love team.</p></div>
          <button type="button" className={css.close} aria-label="Close contact details" onClick={() => setOpen(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
        </div>
        <div className={css.dialogBody} aria-busy={loading}>
          {loading && <p className={css.feedback} role="status">Loading contact details…</p>}
          {error ? <div className={css.feedback}><p role="alert">Contact team details are temporarily unavailable.</p><button className={styles.secondaryButton} type="button" disabled={loading} onClick={() => void reload()}>Retry</button></div>
            : contacts.map(contact => <section className={css.contact} key={contact.kind + ':' + contact.value}>
              <h3>{contact.label}{contact.is_primary && <span>Primary {contact.kind === 'email' ? 'email' : 'phone'}</span>}</h3>
              <ContactOptions expanded email={contact.kind === 'email' ? contact.value : null} phone={contact.kind === 'phone' ? contact.value : null} buttonClassName={styles.secondaryButton} />
            </section>)}
          {!loading && !error && !contacts.length && <p className={css.feedback}>Contact details are not available yet. Please check again later.</p>}
        </div>
      </section>
    </div>, document.body)}
  </>;
}
