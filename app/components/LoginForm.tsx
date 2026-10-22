"use client";

/** One entry screen for sign-in, both registration forms, recovery and dual-workspace selection. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { corporateRolloutEnabled } from '@/lib/feature-flags';
import { isValidPhone, normalisePhone } from '@/lib/contact-details';
import { accountLandingPath, workspaceChoicePath } from '@/lib/actions/account-routing';
import type { Profile } from '@/lib/types';
import { useSignOut } from './useSignOut';
import { useSessionBoundary } from './useSessionBoundary';
import BusinessRegistration from './BusinessRegistration';
import ThemeToggle from './ThemeToggle';
import PortalLoadingScreen from './PortalLoadingScreen';
import styles from './LoginForm.module.css';

type EntryMode = 'signin' | 'volunteer' | 'business' | 'recovery';

export default function LoginForm({ initialMode = 'signin' }: { initialMode?: EntryMode } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<EntryMode>(initialMode);
  const currentMode = useRef<EntryMode>(initialMode);
  const [firstName, setFirstName] = useState(''), [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(''), [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false), [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false), [message, setMessage] = useState('');
  const [chooseWorkspace, setChooseWorkspace] = useState(false);
  const [businessDirty, setBusinessDirty] = useState(false), [businessBusy, setBusinessBusy] = useState(false);
  const pending = useRef(false), businessPending = useRef(false), businessContinuation = useRef(false);
  const returnToSignIn = () => { setChooseWorkspace(false); setEmail(''); setPassword(''); currentMode.current = 'signin'; setMode('signin'); setMessage(''); };
  const { signOut, busy: signingOut, error: signOutError } = useSignOut({ onSignedOut: returnToSignIn });
  const isSignUp = mode === 'volunteer', isForgotPassword = mode === 'recovery', isBusiness = mode === 'business';
  const busy = isLoading || businessBusy;

  const openDestination = useCallback((destination: string) => {
    if (destination === workspaceChoicePath) { setChooseWorkspace(true); return; }
    setIsRedirecting(true); router.replace(destination);
  }, [router]);

  useEffect(() => {
    let active = true;
    async function checkExistingLogin() {
      const query = new URLSearchParams(window.location.search);
      businessContinuation.current = corporateRolloutEnabled && query.get('portal') === 'corporate';
      if (query.get('recovery') === '1') { currentMode.current = 'recovery'; setMode('recovery'); return; }
      // A signed-in volunteer must be able to add business access without being redirected away.
      if (initialMode !== 'signin') return;
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!active || !session?.user || currentMode.current !== 'signin') return;
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select(corporateRolloutEnabled ? 'role, volunteer_enabled' : 'role').eq('id', session.user.id).single<Pick<Profile, 'role' | 'volunteer_enabled'>>();
      if (profileError && profileError.code !== 'PGRST116') throw new Error('Account access could not be checked. Please check your connection and retry.');
      const destination = await accountLandingPath(profile?.role, businessContinuation.current, profile?.volunteer_enabled === true);
      if (!active || currentMode.current !== 'signin') return;
      setEmail(session.user.email || ''); openDestination(destination);
    }
    void checkExistingLogin().catch(failure => { if (active) setMessage(failure instanceof Error ? failure.message : 'Account access could not be checked. Please retry.'); });
    return () => { active = false; };
  }, [router, initialMode, openDestination]);

  async function runAuthRequest(request: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setIsLoading(true); setMessage('');
    try { await request(); }
    catch (failure) { setMessage(`Error: ${failure instanceof Error ? failure.message : 'Account request failed. Please try again.'}`); }
    finally { pending.current = false; setIsLoading(false); }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    await runAuthRequest(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.user) throw new Error('No account was returned. Please try signing in again.');
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select(corporateRolloutEnabled ? 'role, volunteer_enabled' : 'role').eq('id', data.user.id).single<Pick<Profile, 'role' | 'volunteer_enabled'>>();
      if (profileError && profileError.code !== 'PGRST116') throw new Error('Logged in, but account access could not be checked. Please retry.');
      // A user with both memberships chooses; corporate-only users are never offered volunteer access.
      const destination = await accountLandingPath(profile?.role, businessContinuation.current, profile?.volunteer_enabled === true);
      setPassword(''); openDestination(destination);
    });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    const cleanFirst = firstName.trim(), cleanLast = lastName.trim();
    if (!cleanFirst || !cleanLast || !dateOfBirth || !email || !password) { setMessage('Please fill out your First Name, Last Name, Date of Birth, Email, and Password.'); return; }
    if (password.length < 8 || password.length > 128) { setMessage('Please use a password between eight and 128 characters.'); return; }
    if (corporateRolloutEnabled && !isValidPhone(phone)) { setMessage('Please enter a valid cellphone number.'); return; }
    await runAuthRequest(async () => {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: `${cleanFirst} ${cleanLast}`, date_of_birth: dateOfBirth, ...(corporateRolloutEnabled ? { phone: normalisePhone(phone) } : {}) },
      } });
      if (error) throw error;
      setMessage('If this address can be registered, a confirmation link will be sent. Verify your email, then sign in. Already have a login? Use your existing password.');
      setFirstName(''); setLastName(''); setDateOfBirth(''); setPhone(''); setPassword('');
      currentMode.current = 'signin'; setMode('signin');
    });
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!email) { setMessage('Please enter your email address first.'); return; }
    await runAuthRequest(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/update-password` });
      if (error) throw error;
      setMessage('If an account exists for this email, a password reset link will be sent. Please check your inbox.'); setEmail('');
    });
  }

  async function handleGoogleLogin() {
    await runAuthRequest(async () => {
      // Return through shared account routing, so OAuth does not bypass the workspace choice.
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: businessContinuation.current ? `${window.location.origin}/?portal=corporate` : `${window.location.origin}/`,
      } });
      if (error) throw error;
    });
  }

  function changeMode(next: EntryMode) {
    if (pending.current || businessPending.current) return false;
    if (businessDirty && !window.confirm('Discard your unsaved business registration details?')) return false;
    currentMode.current = next; setMode(next); setBusinessDirty(false); setMessage(''); setShowPassword(false); setPassword('');
    if (next !== 'signin') businessContinuation.current = false;
    return true;
  }
  function continueBusinessSignIn(address?: string) {
    if (changeMode('signin')) { businessContinuation.current = true; if (address) setEmail(address); }
  }

  if (isRedirecting) return <PortalLoadingScreen message="Ladles of Love is securely opening your portal…" />;
  const title = chooseWorkspace ? 'Choose your workspace' : isForgotPassword ? 'Reset your password' : isBusiness ? 'Register your organisation' : isSignUp ? 'Start making a difference' : 'Welcome back';
  return <main className={styles.page}>
    <header className={styles.header}><ThemeToggle /></header>
    <div className={styles.layout}><section className={styles.formSide} aria-labelledby="auth-title">
      <div className={styles.brand}><Image src="/Ladles-logo.png" alt="Ladles of Love" width={68} height={68} preload /><span><strong>LADLES OF LOVE</strong><small>{corporateRolloutEnabled ? 'COMMUNITY PORTAL' : 'VOLUNTEER PORTAL'}</small></span></div>
      <div className={styles.card}>
        {!chooseWorkspace && !isForgotPassword && <div className={`${styles.tabs} ${corporateRolloutEnabled ? styles.tabsThree : ''}`} aria-label="Account access">
          <button type="button" disabled={busy} aria-pressed={mode === 'signin'} onClick={() => changeMode('signin')}>Sign in</button>
          <button type="button" disabled={busy} aria-pressed={isSignUp} onClick={() => changeMode('volunteer')}>Volunteer registration</button>
          {corporateRolloutEnabled && <button type="button" disabled={busy} aria-pressed={isBusiness} onClick={() => changeMode('business')}>Business registration</button>}
        </div>}
        <span className={styles.eyebrow}>{chooseWorkspace ? 'One account, separate workspaces' : isForgotPassword ? 'Account recovery' : isBusiness ? 'Bring your team together' : isSignUp ? 'Join the community' : 'Your next act of kindness starts here'}</span>
        <h2 id="auth-title">{title}</h2>
        <p className={styles.intro}>{chooseWorkspace ? 'Your volunteer and business activity is kept in separate workspaces.' : isForgotPassword ? 'Enter your email and we’ll send you a reset link.' : isBusiness ? 'Register your business and main contact for admin approval. Already have a login? Use that account.' : isSignUp ? 'Create your volunteer account to book shifts and track your contribution.' : corporateRolloutEnabled ? 'One sign-in for volunteering and business bookings. We’ll open the workspace available to your account.' : 'Manage your shifts and view your impact.'}</p>
        {chooseWorkspace ? <WorkspaceChoice email={email} openDestination={openDestination} signOut={signOut} signingOut={signingOut} error={signOutError} returnToSignIn={returnToSignIn} /> : isBusiness ? corporateRolloutEnabled ? <BusinessRegistration onSignIn={continueBusinessSignIn} onDirtyChange={setBusinessDirty} onBusyChange={value => { businessPending.current = value; setBusinessBusy(value); }} /> : <p className={styles.notice}>Business registration is not open yet. Use Sign in or Volunteer registration above.</p> : <>
          <form onSubmit={isForgotPassword ? handleResetPassword : isSignUp ? handleSignUp : handleLogin} aria-busy={isLoading}><fieldset className={styles.fields} disabled={isLoading}><legend className={styles.srOnly}>{title}</legend>
            {isSignUp && <><div className={styles.nameRow}><div className={styles.field}><label htmlFor="first-name">First name</label><input id="first-name" autoComplete="given-name" required value={firstName} onChange={event => setFirstName(event.target.value)} /></div><div className={styles.field}><label htmlFor="last-name">Last name</label><input id="last-name" autoComplete="family-name" required value={lastName} onChange={event => setLastName(event.target.value)} /></div></div><div className={styles.field}><label htmlFor="birth-date">Date of birth</label><input id="birth-date" type="date" autoComplete="bday" required max={new Date().toISOString().slice(0,10)} value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} /></div></>}
            {isSignUp && corporateRolloutEnabled && <div className={styles.field}><label htmlFor="signup-phone">Cellphone number</label><input id="signup-phone" type="tel" autoComplete="tel" required maxLength={25} value={phone} onChange={event => setPhone(event.target.value)} /></div>}
            <div className={styles.field}><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div>
            {!isForgotPassword && <div className={styles.field}><div className={styles.labelRow}><label htmlFor="auth-password">Password</label>{!isSignUp && <button className={styles.textButton} type="button" onClick={() => changeMode('recovery')}>Forgot password?</button>}</div><div className={styles.password}><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={isSignUp ? 8 : undefined} maxLength={isSignUp ? 128 : undefined} value={password} onChange={event => setPassword(event.target.value)} placeholder={isSignUp ? 'Create a password' : 'Enter your password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></div>}
            {message && <div className={/error|failed|please fill|couldn't|please enter|please use/i.test(message) ? styles.error : styles.notice} role="status">{message}</div>}
            <button type="submit" className={styles.submit}>{isLoading ? 'Please wait…' : isForgotPassword ? 'Send reset link' : isSignUp ? 'Create volunteer account' : 'Sign in'}<span aria-hidden="true">→</span></button>
          </fieldset></form>
          {!isForgotPassword && <><div className={styles.divider}><span>or continue with</span></div><button type="button" className={styles.google} disabled={isLoading} onClick={() => void handleGoogleLogin()}><GoogleIcon />Continue with Google</button></>}
          <p className={styles.footer}>{isForgotPassword ? <button type="button" disabled={busy} className={styles.textButton} onClick={() => changeMode('signin')}>← Back to sign in</button> : isSignUp ? <>Already have a login? <button type="button" disabled={busy} className={styles.textButton} onClick={() => changeMode('signin')}>Sign in</button></> : corporateRolloutEnabled ? 'New here? Choose Volunteer registration or Business registration above.' : 'New here? Choose Volunteer registration above.'}</p>
        </>}
      </div><p className={styles.support}>Your time matters. Thank you for choosing to give it.</p>
    </section></div>
  </main>;
}

/** This boundary is mounted afresh for each login, so another tab cannot leave a stale account choice. */
export function WorkspaceChoice({ email, openDestination, signOut, signingOut, error, returnToSignIn }: {
  email: string; openDestination: (path: string) => void; signOut: () => Promise<void>; signingOut: boolean; error: string; returnToSignIn: () => void;
}) {
  const sessionEnded = useSessionBoundary(true);
  if (sessionEnded) return <div className={styles.notice}><p>Your session has changed. Sign in again to load the correct account.</p><button type="button" className={styles.textButton} onClick={returnToSignIn}>Return to sign in</button></div>;
  return <div className={styles.fields}>
    {email && <p className={styles.notice}>Signed in as {email}. Choose where you want to continue.</p>}
    <button type="button" className={styles.workspaceOption} disabled={signingOut} onClick={() => openDestination('/volunteer')}><strong>Volunteer workspace</strong><span>Book individual shifts, record attendance and view your impact.</span></button>
    <button type="button" className={styles.workspaceOption} disabled={signingOut} onClick={() => openDestination('/corporate')}><strong>Business workspace</strong><span>View your organisation’s approval, group bookings and payment updates.</span></button>
    {error && <p className={styles.error} role="alert">{error}</p>}<button type="button" className={styles.textButton} disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out…' : 'Sign out / use another account'}</button>
  </div>;
}

function GoogleIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.2 5.2-4.7 6.8v5.6h7.6c4.5-4.1 7-10.2 7-16.4z" /><path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.4v6.1C6.4 41.8 14.6 47 24 47z" /><path fill="#FBBC04" d="M10.3 27.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5v-6.1H2.4C.9 15.5 0 19.6 0 24s.9 8.5 2.4 11.6l7.9-8.1z" /><path fill="#EA4335" d="M24 9.5c3.6 0 6.9 1.2 9.4 3.7l7-7C36.2 2.1 30.5 0 24 0 14.6 0 6.4 5.2 2.4 12.9l7.9 6.1C12.2 13.8 17.6 9.5 24 9.5z" /></svg>;
}
