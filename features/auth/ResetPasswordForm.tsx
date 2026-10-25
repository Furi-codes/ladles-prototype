"use client";
/**
 * Handles the password-recovery link and saves the replacement password through Auth.
 * The link is checked before the form opens, and provider URL contents are kept out of displayed
 * errors.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { passwordError, passwordRequirements } from '@/lib/auth/password-policy';
import ThemeToggle from '@/components/theme/ThemeToggle';
import styles from '@/features/auth/LoginForm.module.css';

/** Auth reads the recovery session from the redirect URL. We still verify it with the server. */
export default function ResetPasswordForm() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable' | 'saved'>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false), saved = useRef(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search), fragment = new URLSearchParams(window.location.hash.slice(1));
        // Do not echo the provider's URL contents: they can include sensitive tokens.
        if (['error', 'error_code', 'error_description'].some(key => query.has(key) || fragment.has(key))) throw new Error('This password reset link is invalid or has expired. Request a new link below.');
        const { data, error } = await supabase.auth.getUser();
        if (error && error.name !== 'AuthSessionMissingError') throw error;
        if (!data.user) throw new Error('This password reset link is invalid or has expired. Request a new link below.');
        if (active) { setStatus('ready'); setMessage(''); }
      } catch (failure) {
        if (active) { setStatus('unavailable'); setMessage(userFacingError(failure instanceof Error ? failure.message : 'The reset link could not be checked. Retry or request a new link.', "The reset link could not be checked. Retry or request a new link.")); }
      }
    })();
    return () => { active = false; };
  }, [attempt]);
  /**
   * Only submit from a checked recovery session. Lock a successful update immediately so
   * repeated clicks cannot submit it again.
   */
  async function handleUpdatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || saved.current || status !== 'ready') return;
    const invalidPassword = passwordError(newPassword);
    if (invalidPassword) { setMessage(invalidPassword); return; }
    if (newPassword !== confirmation) { setMessage('The passwords do not match.'); return; }
    pending.current = true; setIsLoading(true); setMessage('');
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (!data.user) throw new Error('No updated account was returned. Check your connection and try again.');
      // Lock immediately, so even a second click before rerender cannot resubmit a saved password.
      saved.current = true; setStatus('saved'); setNewPassword(''); setConfirmation('');
      setMessage('Your password has been updated. You can now continue to your account.');
    } catch (failure) { setMessage(userFacingError(failure instanceof Error ? failure.message : 'Password update could not be confirmed. Please retry.', "Password update could not be confirmed. Please retry.")); }
    finally { pending.current = false; setIsLoading(false); }
  }
  return <main className={styles.page}><header className={styles.header}><ThemeToggle /></header>
    <div className={styles.layout}><section className={styles.formSide} aria-labelledby="reset-title">
      <div className={styles.brand}><span className={styles.brandMark}><Image className={styles.brandImage} src="/Ladles-logo.png" alt="Ladles of Love" width={72} height={72} /></span><span><strong>LADLES OF LOVE</strong><small>ACCOUNT RECOVERY</small></span></div>
      <div className={styles.card}><h2 id="reset-title">Set a new password</h2>
        {status === 'checking' && <p role="status">Verifying secure link…</p>}
        {message && <p className={status === 'saved' ? styles.notice : styles.error} role={status === 'saved' ? 'status' : 'alert'}>{message}</p>}
        {status === 'ready' && <form onSubmit={handleUpdatePassword} aria-busy={isLoading}><fieldset className={styles.fields} disabled={isLoading}><legend className={styles.srOnly}>New password</legend>
          <p className={styles.intro}>{passwordRequirements}</p>
          <div className={styles.field}><label htmlFor="reset-password">New password</label><div className={styles.password}>
            <input id="reset-password" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
            <button type="button" aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
          </div></div>
          <div className={styles.field}><label htmlFor="reset-confirmation">Confirm new password</label><input id="reset-confirmation" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
          <button type="submit" className={styles.submit}>{isLoading ? 'Saving…' : 'Update password'}</button>
        </fieldset></form>}
        {status === 'unavailable' && <><button className={styles.google} onClick={() => { setStatus('checking'); setMessage(''); setAttempt(value => value + 1); }}>Retry link check</button><p className={styles.footer}><Link href="/?recovery=1">Request a new reset link</Link></p></>}
        {status === 'saved' && <Link className={styles.google} href="/">Continue to my account</Link>}
        {status !== 'saved' && <p className={styles.footer}><Link href="/">Back to sign in</Link></p>}
      </div>
    </section></div>
  </main>;
}
