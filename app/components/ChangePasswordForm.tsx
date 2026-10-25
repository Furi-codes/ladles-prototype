"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { changeAccountPassword } from '@/lib/actions/password';
import { passwordRequirements } from '@/lib/password-policy';
import { userFacingError } from '@/lib/user-facing-error';
import { useUnsavedChanges } from './useUnsavedChanges';
import styles from './ChangePasswordForm.module.css';

export default function ChangePasswordForm({ email }: { email: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef(false);
  const confirmDiscard = useUnsavedChanges(open && Boolean(current || password || confirmation));
  function clear() { setCurrent(''); setPassword(''); setConfirmation(''); setShow(false); setError(''); }
  return <section className={styles.card} aria-label="Change password">
    <div className={styles.header}><div><h2>Change password</h2><p>Update the password you use to sign in.</p></div>
      {!open && <button type="button" className={styles.secondary} disabled={!email} onClick={() => { setOpen(true); setMessage(''); }}>Change password</button>}
    </div>
    {message && <p role="status" className={styles.message}>{message}</p>}
    {open && <form className={styles.form} aria-busy={busy} onSubmit={async event => {
      event.preventDefault(); if (pending.current) return;
      pending.current = true; setBusy(true); setError(''); setMessage('');
      try {
        await changeAccountPassword(email, current, password, confirmation);
        clear(); setOpen(false); setMessage('Your password has been updated. Use your new password next time you sign in.');
      } catch (failure) { setError(userFacingError(failure, 'Your password could not be changed. Please try again.')); }
      finally { pending.current = false; setBusy(false); }
    }}><fieldset disabled={busy}>
      <legend className="sr-only">Change your sign-in password</legend>
      <label>Current password<input type={show ? 'text' : 'password'} autoComplete="current-password" required value={current} onChange={event => setCurrent(event.target.value)} /></label>
      <label>New password<input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /><span className={styles.hint}>{passwordRequirements}</span></label>
      <label>Confirm new password<input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      <label className={styles.show}><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} />Show passwords</label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => { if (confirmDiscard()) { clear(); setOpen(false); } }}>Cancel</button><button type="submit" className={styles.primary}>{busy ? 'Updating…' : 'Update password'}</button></div>
      <Link href="/?recovery=1">Forgot your current password?</Link>
    </fieldset></form>}
  </section>;
}
