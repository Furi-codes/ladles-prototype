"use client";

import { useRef, useState } from 'react';
import { useUnsavedChanges } from '@/app/components/useUnsavedChanges';
import type { CorporateAccountInput } from '@/lib/corporate-account-types';
import styles from '@/app/admin/admin.module.css';

export const emptyCorporateDetails: CorporateAccountInput = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', billing_address: '' };

/** Shared by registration and profile editing; no status/owner/payment fields can be entered here. */
export default function CorporateAccountForm({ initial = emptyCorporateDetails, submit, label = 'Save details', children, onDirtyChange }: {
  initial?: CorporateAccountInput; submit: (details: CorporateAccountInput, password: string) => Promise<void>; label?: string; children?: React.ReactNode; onDirtyChange?: (dirty: boolean) => void;
}) {
  const [details, setDetails] = useState<CorporateAccountInput>({ company_name: initial.company_name, contact_name: initial.contact_name, contact_email: initial.contact_email, contact_phone: initial.contact_phone, billing_address: initial.billing_address });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const dirty = !saved && (Object.keys(details).some(key => details[key as keyof CorporateAccountInput] !== initial[key as keyof CorporateAccountInput]) || Boolean(password));
  useUnsavedChanges(dirty);
  const change = (key: keyof CorporateAccountInput, value: string) => { const next = { ...details, [key]: value }; setSaved(false); setDetails(next); onDirtyChange?.(Object.keys(next).some(field => next[field as keyof CorporateAccountInput] !== initial[field as keyof CorporateAccountInput])); };
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    try { await submit(details, password); setSaved(true); setPassword(''); onDirtyChange?.(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Details could not be saved. Please retry.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form onSubmit={save} aria-busy={busy}>
    <fieldset disabled={busy} className={styles.formGrid} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend className="sr-only">Company and main contact details</legend>
      {([['company_name','Company / organisation','text',180],['contact_name','Main point of contact','text',180],['contact_email','Contact email','email',254],['contact_phone','Contact phone','tel',25]] as const).map(([key, title, type, length]) => <label key={key} className={styles.field}><span className={styles.fieldLabel}>{title}</span><input className={styles.input} type={type} required maxLength={length} value={details[key]} onChange={event => change(key, event.target.value)} autoComplete={key === 'contact_phone' ? 'tel' : key === 'contact_email' ? 'email' : key === 'company_name' ? 'organization' : 'name'} /></label>)}
      <label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Full billing address</span><textarea className={styles.input} style={{ minHeight: 90, paddingTop: 12 }} required maxLength={1000} value={details.billing_address} onChange={event => change('billing_address', event.target.value)} autoComplete="street-address" /></label>
      {children && <><label className={`${styles.field} ${styles.fieldFull}`}><span className={styles.fieldLabel}>Create a password</span><input className={styles.input} type="password" required minLength={8} maxLength={128} value={password} onChange={event => { setSaved(false); setPassword(event.target.value); }} autoComplete="new-password" /></label>{children}</>}
      {error && <div className={`${styles.error} ${styles.fieldFull}`} role="alert">{error}</div>}
      <div className={`${styles.formActions} ${styles.fieldFull}`}><button className={styles.primaryButton} type="submit">{busy ? 'Saving…' : label}</button></div>
    </fieldset>
  </form>;
}
