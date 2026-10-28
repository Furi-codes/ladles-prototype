"use client";

/**
 * Opens the current portal's contact details below its header button.
 * The non-modal dropdown leaves the page scrollable and closes on Escape or outside interaction.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPortalContacts } from '@/business/shared/contacts/api';
import { portalContactsChanged, type ContactPortal } from '@/business/shared/contacts/validation';
import { useFeatureData } from '@/presentation/components/ui/FeatureShared';
import ContactOptions from '@/presentation/components/contacts/ContactOptions';
import styles from '@/presentation/styles/volunteer.module.css';
import css from '@/presentation/components/contacts/portal-contacts.module.css';

/** One header shortcut per portal. Contact details stay separate from email/call app actions. */
export default function PortalContactButton({ portal }: { portal: ContactPortal }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ left: number; width: number; maxHeight: number } | null>(null);
  const shortcut = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const loader = useCallback(() => getPortalContacts(portal), [portal]);
  const { data, loading, error, reload } = useFeatureData(loader);
  const titleId = `portal-contact-${portal}`;
  const panelId = `${titleId}-details`;

  // Keep the panel below its own button and inside narrow/mobile viewports.
  const placePanel = useCallback(() => {
    if (!shortcut.current) return;
    const bounds = shortcut.current.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const width = Math.min(400, viewportWidth - 24);
    const left = Math.max(12, Math.min(bounds.right - width, viewportWidth - width - 12));
    setPlacement({ left: left - bounds.left, width, maxHeight: Math.max(80, window.innerHeight - bounds.bottom - 22) });
  }, []);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };

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
    placePanel();
    panel.current?.focus({ preventScroll: true });
    const outside = (event: Event) => { if (!shortcut.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [open, placePanel]);

  // Never show cached details for the other portal or an empty shortcut before contacts exist.
  const contacts = data?.portal === portal ? [...data.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)) : [];
  if (!open && !error && !contacts.length) return null;

  return <div className={css.shortcut} ref={shortcut}>
    <button ref={trigger} type="button" className={css.trigger} aria-label="Contact team" title="Contact team" aria-haspopup="dialog" aria-controls={open ? panelId : undefined} aria-expanded={open} onClick={() => { if (open) { setOpen(false); return; } placePanel(); setOpen(true); void reload(); }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /><path d="M8 12h8M8 8h5" /></svg>
      <span>Contact team</span>
    </button>
    {/* Staying beside the trigger in the DOM preserves the normal keyboard tab order. */}
    {open && <section ref={panel} id={panelId} tabIndex={-1} data-contact-dropdown className={css.dropdown} style={placement ?? undefined} role="dialog" aria-labelledby={titleId}>
        <div className={css.dialogHeader}>
          <div><h2 id={titleId}>{portal === 'corporate' ? 'Corporate booking support' : 'Volunteer support'}</h2><p>Get in touch with the Ladles of Love team.</p></div>
          <button type="button" className={css.close} aria-label="Close contact details" onClick={close}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
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
      </section>}
  </div>;
}
