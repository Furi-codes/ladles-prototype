"use client";

import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from '@/app/components/ThemeToggle';
import { usePathname } from 'next/navigation';
import { useSignOut } from '@/app/components/useSignOut';
import { useSessionBoundary } from '@/app/components/useSessionBoundary';
import { corporateBookingsEnabled, corporateOutcomesEnabled } from '@/lib/feature-flags';
import styles from '../corporate.module.css';
import admin from '@/app/admin/admin.module.css';

/** Uses the existing portal colours and a sticky account bar, without volunteer/WMS data providers. */
export default function CorporateFrame({ children, signedIn = false, workflowAccess = false }: { children: React.ReactNode; signedIn?: boolean; workflowAccess?: boolean }) {
  const { signOut: endSession, busy, error } = useSignOut();
  const sessionEnded = useSessionBoundary(signedIn);
  const pathname = usePathname();
  async function signOut() {
    if (!busy && window.confirm('Sign out of the corporate portal?')) await endSession();
  }
  if (sessionEnded) return <div className={`portalUi ${styles.shell}`}><main className={styles.main}><h1>Your session has changed</h1><p>Sign in again to load the correct business account. Previous account details have been hidden.</p><Link className={admin.primaryButton} href="/?portal=corporate">Continue to sign in</Link></main></div>;
  return <div className={`portalUi ${styles.shell}`}><a className="portalSkipLink" href="#corporate-content">Skip to content</a><header className={styles.header}><Link className={styles.brand} href="/corporate"><Image src="/Ladles-logo.png" alt="Ladles of Love" width={40} height={48} /><span><strong>LADLES OF LOVE</strong><small>CORPORATE PORTAL</small></span></Link><div className={styles.actions}><ThemeToggle />{signedIn ? <button className={admin.secondaryButton} disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign out'}</button> : <Link className={admin.secondaryButton} href="/?portal=corporate">Sign in</Link>}</div></header><main id="corporate-content" className={styles.main}>{error && <p className={admin.error} role="alert">{error}</p>}{signedIn && workflowAccess && corporateBookingsEnabled && <nav className={styles.tabs} aria-label="Corporate workspace">{[['/corporate/bookings','My bookings'],['/corporate/events','Browse events'],['/corporate/updates','Booking updates'],['/corporate','Business profile'],...(corporateOutcomesEnabled ? [['/corporate/reports','Group reports']] : [])].map(([href,label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>}{children}</main></div>;
}
