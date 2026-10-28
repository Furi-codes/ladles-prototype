"use client";

/**
 * Edits the contact methods shown in the volunteer and corporate portals.
 * Each portal is saved separately and uses the shared contact validator before sending its
 * settings.
 */

import { userFacingError } from '@/business/shared/errors/user-facing';

import { useCallback, useRef, useState } from 'react';
import { getPortalContacts, savePortalContacts } from '@/business/shared/contacts/api';
import { logAdminAction } from '@/business/admin/services/audit';
import { portalContactsChanged, type ContactPortal, type PortalContact, type PortalContactSettings as ContactSettings } from '@/business/shared/contacts/validation';
import { useUnsavedChanges } from '@/presentation/hooks/useUnsavedChanges';
import { FeatureState, useFeatureData } from '@/presentation/components/ui/FeatureShared';
import styles from '@/presentation/styles/admin.module.css';
import css from '@/presentation/components/contacts/portal-contacts.module.css';

export default function PortalContactSettings({ busyChanged }: { busyChanged: (busy: boolean) => void }) {
  return <div className={styles.featureStack}>
    <p className={styles.helper}>Manage the approved contacts shown under Contact team. Each portal has its own list. Add an email, a phone number, or both; choose a primary contact for each type.</p>
    <PortalContactSection portal="volunteer" busyChanged={busyChanged} />
    <PortalContactSection portal="corporate" busyChanged={busyChanged} />
  </div>;
}
function PortalContactSection({ portal, busyChanged }: { portal: ContactPortal; busyChanged: (busy: boolean) => void }) {
  const loader = useCallback(() => getPortalContacts(portal), [portal]);
  const { data, error, loading, reload } = useFeatureData(loader);
  const [saved, setSaved] = useState<ContactSettings | null>(null), [message, setMessage] = useState('');
  const current = saved ?? data;
  return <section className={styles.card}>
    <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>{portal === 'volunteer' ? 'Volunteer portal contacts' : 'Corporate portal contacts'}</h2><p className={styles.cardHint}>{portal === 'volunteer' ? 'Support for individual volunteers.' : 'Group booking and payment enquiries.'}</p></div></div>
    <div className={styles.featureBody}>
      <FeatureState loading={loading} error={error} retry={() => void reload()} />
      {message && <p role="status" className={styles.helper}>{message}</p>}
      {!loading && !error && current && <PortalContactForm key={current.version} initial={current} busyChanged={busyChanged} reload={async () => { setSaved(null); setMessage(''); await reload(); }} saved={result => {
        setSaved(result); setMessage('Contact details saved.'); window.dispatchEvent(new Event(portalContactsChanged));
        // A committed settings change must not look unsuccessful if audit refresh is offline.
        void logAdminAction({ action:'PORTAL_CONTACTS_UPDATED',entityType:'PORTAL_CONTACT_SETTINGS',entityId:portal,entityLabel:portal === 'volunteer' ? 'Volunteer portal contacts' : 'Corporate portal contacts',details:{contact_methods:result.contacts.length} }).catch(() => {});
      }} />}
    </div>
  </section>;
}
export function PortalContactForm({ initial, saved, reload, busyChanged }: { initial: ContactSettings; saved: (settings: ContactSettings) => void; reload: () => Promise<void>; busyChanged: (busy: boolean) => void }) {
  const [contacts, setContacts] = useState<PortalContact[]>(() => initial.contacts.map(contact => ({...contact})));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const dirty = JSON.stringify(contacts) !== JSON.stringify(initial.contacts);
  useUnsavedChanges(dirty || busy);
  function add(kind: PortalContact['kind']) { setContacts(current => current.length >= 12 ? current : [...current,{kind,label:'',value:'',is_primary:!current.some(contact => contact.kind === kind)}]); }
  function remove(index: number) {
    setContacts(current => {
      const removed = current[index], next = current.filter((_,position) => position !== index);
      if (removed.is_primary) { const first = next.find(contact => contact.kind === removed.kind); if (first) return next.map(contact => contact === first ? {...contact,is_primary:true} : contact); }
      return next;
    });
  }
  function update(index: number, field: 'label' | 'value', value: string) { setContacts(current => current.map((contact,position) => position === index ? {...contact,[field]:value} : contact)); }
  return <form className={css.editor} aria-label={`${initial.portal} portal contacts`} onSubmit={async event => {
    event.preventDefault(); if (pending.current) return;
    pending.current=true; setBusy(true); busyChanged(true); setError('');
    try { const result=await savePortalContacts(initial.portal,initial.version,contacts); saved(result); }
    catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Contacts could not be saved. Please retry.', "Contacts could not be saved. Please retry.")); }
    finally { pending.current=false;setBusy(false);busyChanged(false); }
  }}>
    <fieldset disabled={busy} className={css.fields}><legend className={css.srOnly}>Contact methods</legend>
      {contacts.map((contact,index) => <div key={index} className={css.contactEditor}>
        <label className={styles.field}><span className={styles.fieldLabel}>Label</span><input className={styles.input} required maxLength={80} value={contact.label} placeholder={initial.portal === 'corporate' ? 'e.g. Corporate bookings' : 'e.g. Volunteer support'} onChange={event => update(index,'label',event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>{contact.kind === 'email' ? 'Email address' : 'Phone number'}</span><input className={styles.input} type={contact.kind === 'email' ? 'email' : 'tel'} required maxLength={contact.kind === 'email' ? 254 : 25} value={contact.value} onChange={event => update(index,'value',event.target.value)} /></label>
        <label className={css.primary}><input type="radio" name={`${initial.portal}-primary-${contact.kind}`} checked={contact.is_primary} onChange={() => setContacts(current => current.map((entry,position) => entry.kind === contact.kind ? {...entry,is_primary:position === index} : entry))} />Primary {contact.kind === 'email' ? 'email' : 'phone'}</label>
        <button type="button" className={styles.dangerButton} aria-label={`Remove ${contact.label || contact.kind}`} onClick={() => remove(index)}>Remove</button>
      </div>)}
      {!contacts.length && <p className={styles.helper}>No contact methods added. The Contact team control stays hidden until you save a contact.</p>}
      <div className={css.actions}><button type="button" className={styles.secondaryButton} disabled={contacts.length >= 12} onClick={() => add('email')}>Add email</button><button type="button" className={styles.secondaryButton} disabled={contacts.length >= 12} onClick={() => add('phone')}>Add phone</button></div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={css.saveActions}><button type="button" className={styles.secondaryButton} onClick={() => { if (!dirty || window.confirm('Discard unsaved contact changes and reload?')) void reload(); }}>Reload saved contacts</button><button type="submit" className={styles.primaryButton} disabled={!dirty}>{busy ? 'Saving…' : 'Save contacts'}</button></div>
    </fieldset>
  </form>;
}
