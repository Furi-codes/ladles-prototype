"use client";
/**
 * Collects company, main-contact and billing details for registration or updates.
 * Both uses share the same validation, while a password is collected only when the caller
 * requires registration.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { useRef, useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { passwordRequirements } from '@/lib/auth/password-policy';
import type { CorporateAccountInput } from '@/features/corporate/types/accounts';
import styles from '@/styles/admin.module.css';
import authStyles from '@/features/auth/LoginForm.module.css';

export const emptyCorporateDetails: CorporateAccountInput = { company_name: '', contact_name: '', contact_email: '', contact_phone: '', billing_address: '' };

/** Shared by registration and profile editing; no status/owner/payment fields can be entered here. */
export default function CorporateAccountForm({ initial = emptyCorporateDetails, submit, label = 'Save details', children, onDirtyChange, onBusyChange, appearance = 'portal' }: {
  initial?: CorporateAccountInput; submit: (details: CorporateAccountInput, password: string) => Promise<void>; label?: string; children?: React.ReactNode; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; appearance?: 'portal' | 'auth';
}) {
  const ui = appearance === 'auth' ? { ...styles, formGrid: authStyles.fields, field: authStyles.field, fieldLabel: authStyles.fieldLabel, input: authStyles.input, fieldFull: authStyles.full, formActions: authStyles.formActions, primaryButton: authStyles.submit, error: authStyles.error } : styles;
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
    setBusy(true); onBusyChange?.(true); setError('');
    try { await submit(details, password); setSaved(true); setPassword(''); onDirtyChange?.(false); }
    catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Details could not be saved. Please retry.', "Details could not be saved. Please retry.")); }
    finally { pending.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <form onSubmit={save} aria-busy={busy}>
    <fieldset disabled={busy} className={ui.formGrid} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend className="sr-only">Company and main contact details</legend>
      {([['company_name','Company / organisation','text',180],['contact_name','Main point of contact','text',180],['contact_email','Contact email','email',254],['contact_phone','Contact phone','tel',25]] as const).map(([key, title, type, length]) => <label key={key} className={ui.field}><span className={ui.fieldLabel}>{title}</span><input className={ui.input} type={type} required maxLength={length} value={details[key]} onChange={event => change(key, event.target.value)} autoComplete={key === 'contact_phone' ? 'tel' : key === 'contact_email' ? 'email' : key === 'company_name' ? 'organization' : 'name'} /></label>)}
      <label className={`${ui.field} ${ui.fieldFull}`}><span className={ui.fieldLabel}>Full billing address</span><textarea className={ui.input} style={{ minHeight: 90, paddingTop: 12 }} required maxLength={1000} value={details.billing_address} onChange={event => change('billing_address', event.target.value)} autoComplete="street-address" /></label>
      {children && <><label className={`${ui.field} ${ui.fieldFull}`}><span className={ui.fieldLabel}>Create a password</span><input className={ui.input} type="password" required minLength={8} maxLength={128} value={password} onChange={event => { setSaved(false); setPassword(event.target.value); onDirtyChange?.(true); }} autoComplete="new-password" /><span className={styles.helper}>{passwordRequirements}</span></label>{children}</>}
      {error && <div className={`${ui.error} ${ui.fieldFull}`} role="alert">{error}</div>}
      <div className={`${ui.formActions} ${ui.fieldFull}`}><button className={ui.primaryButton} type="submit">{busy ? 'Saving…' : label}</button></div>
    </fieldset>
  </form>;
}
