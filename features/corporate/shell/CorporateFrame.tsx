"use client";
/**
 * Renders the corporate header, navigation and responsive workspace frame.
 * Shared contact, notification and account controls remain available across feature pages.
 */

import { useState } from 'react';
import PortalBrand from '@/components/branding/PortalBrand';
import Link from 'next/link';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { useSignOut } from '@/hooks/useSignOut';
import { useSessionBoundary } from '@/hooks/useSessionBoundary';
import type { CorporateAccount } from '@/features/corporate/types/accounts';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PortalContactButton from '@/components/contacts/PortalContactButton';
import CorporateNavigation from '@/features/corporate/shell/CorporateNavigation';
import CorporateNotificationBell from '@/features/corporate/notifications/CorporateNotificationBell';
import { corporateBookingsEnabled } from '@/lib/config/features';
import volunteer from '@/styles/volunteer.module.css';
import styles from '@/styles/corporate.module.css';
import admin from '@/styles/admin.module.css';
import { usePortalMotion } from '@/components/experience/usePortalMotion';

/** Reuse the volunteer presentation, not its data provider: company access remains separate. */
export default function CorporateFrame({ children, signedIn = false, workflowAccess = false, account, signInEmail, avatarUrl }: {
  children: React.ReactNode; signedIn?: boolean; workflowAccess?: boolean; account?: CorporateAccount | null; signInEmail?: string; avatarUrl?: string | null;
}) {
  const { signOut, busy, error } = useSignOut();
  const sessionEnded = useSessionBoundary(signedIn);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const motionRoot = usePortalMotion(signedIn && !sessionEnded);
  // Enable the shared button/card rules used by corporate forms as well as volunteer styling.
  const shell = `portalUi ${admin.shell} ${volunteer.shell} ${styles.shell}`;
  // The brand returns approved companies to their workspace; the account icon
  // remains the profile shortcut. Unapproved companies stay on their review page.
  const homeHref = !signedIn ? '/' : workflowAccess && corporateBookingsEnabled ? '/corporate/bookings' : '/corporate';
  if (sessionEnded) return <div className={shell}><main className={volunteer.content}><h1 className={volunteer.pageTitle}>Your session has changed</h1><p>Sign in again to load the correct business account. Previous account details have been hidden.</p><Link className={volunteer.primaryButton} href="/">Continue to sign in</Link></main></div>;

  return <div ref={motionRoot} data-experience="corporate" className={shell}>
    <a className="portalSkipLink" href="#corporate-content">Skip to content</a>
    <div className={volunteer.topAccent} />
    <header className={`${volunteer.topbar} ${styles.header}`}>
      <Link className={volunteer.brand} href={homeHref} aria-label={homeHref === '/corporate/bookings' ? 'Ladles of Love — My bookings' : signedIn ? 'Ladles of Love business profile' : 'Ladles of Love — Sign in'}>
        <PortalBrand portal="Corporate portal" />
      </Link>
      {signedIn && workflowAccess && <CorporateNavigation />}
      <div className={`${volunteer.topActions} ${styles.headerActions}`}>
        {signedIn && <PortalContactButton portal="corporate" />}
        {signedIn && workflowAccess && corporateBookingsEnabled && <CorporateNotificationBell />}
        <ThemeToggle />
        {signedIn ? <>
          {account && <Link href="/corporate" className={`${volunteer.account} ${styles.headerAccount}`} aria-label="Open business profile" title="Business profile and account settings"><ProfileAvatar name={account.company_name} src={avatarUrl} /><div className={volunteer.accountDetails}><span className={volunteer.accountName}>{account.company_name}</span><span className={volunteer.accountEmail}>{signInEmail || 'Business account'}</span></div></Link>}
          <button type="button" className={volunteer.signOut} disabled={busy} onClick={() => setConfirmSignOut(true)}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </> : <Link className={volunteer.secondaryButton} href="/">Sign in</Link>}
      </div>
    </header>
    <main id="corporate-content" tabIndex={-1} className={`${volunteer.content} ${styles.main}`}>
      {error && !confirmSignOut && <p className={volunteer.error} role="alert">{error}</p>}
      {children}
    </main>
    {signedIn && workflowAccess && <CorporateNavigation mobile />}
    {confirmSignOut && <ConfirmDialog title="Sign out?" message="Are you sure you want to sign out of the corporate portal?" confirmLabel={busy ? 'Signing out…' : 'Sign out'} busy={busy} error={error} onCancel={() => setConfirmSignOut(false)} onConfirm={() => void signOut()} />}
  </div>;
}
