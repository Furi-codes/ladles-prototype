"use client";
/**
 * Keeps the admin header, sidebar and page content in one workspace layout.
 * The access/loading state is handled here so individual screens do not repeat the full shell.
 */

import { useRef, useState } from "react";
import { useDialogFocus } from '@/hooks/useDialogFocus';
import Link from "next/link";
import { useNavigationDrawer } from "@/hooks/useNavigationDrawer";
import { useSignOut } from "@/hooks/useSignOut";
import { useSessionBoundary } from "@/hooks/useSessionBoundary";
import styles from "@/styles/admin.module.css";
import Sidebar from "@/features/admin/shell/Sidebar";
import TopHeader from "@/features/admin/shell/TopHeader";
import { useAdminData } from "@/features/admin/shell/AdminProvider";
import AdminLoadingScreen from "@/features/admin/shell/AdminLoadingScreen";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { signOut: handleSignOut, busy: signingOut, error: signOutError } = useSignOut();
  const { adminProfile, isCheckingAccess, accessError, retryAccess, loadError } = useAdminData();
  const sessionEnded = useSessionBoundary(!isCheckingAccess);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const signOutPanel=useRef<HTMLElement>(null);
  useDialogFocus(showSignOutConfirm && !sessionEnded && !isCheckingAccess,signOutPanel,()=>setShowSignOutConfirm(false),signingOut);

  useNavigationDrawer(mobileNavOpen, () => setMobileNavOpen(false), "admin-mobile-navigation", 760);

  // Do not leave cached volunteer/company details visible after another tab changes the session.
  if (sessionEnded) return <div className={`portalUi ${styles.shell}`}><main className={styles.content}><h1>Your session has changed</h1><p>Sign in again to load the correct account. Previous administration details have been hidden.</p><Link className={styles.primaryButton} href="/">Continue to sign in</Link></main></div>;
  if (accessError) return <div className="portalUi"><main className={styles.content}><p className={styles.error} role="alert">{accessError}</p><button className={styles.secondaryButton} onClick={retryAccess}>Retry access check</button></main></div>;
  if (isCheckingAccess) return <AdminLoadingScreen />;

  return <div className={`portalUi ${styles.shell}`}>
    <a className="portalSkipLink" href="#admin-content">Skip to content</a>
    {mobileNavOpen && <button type="button" className={styles.mobileNavBackdrop} aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    <div className={styles.main}>
      <TopHeader name={adminProfile.full_name || "Administrator"} email={adminProfile.email} onSignOut={() => setShowSignOutConfirm(true)} menuOpen={mobileNavOpen} onMenu={() => setMobileNavOpen((open) => !open)} />
      <main id="admin-content" tabIndex={-1} className={styles.content}>
        {loadError && <div className={styles.error} role="alert">{loadError}</div>}
        {children}
      </main>
    </div>
    {showSignOutConfirm && <div className={styles.dialogBackdrop} role="presentation"><section ref={signOutPanel} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sign-out-title"><h2 id="sign-out-title" className={styles.dialogTitle}>Sign out?</h2><p className={styles.dialogText}>Are you sure you want to sign out of the administration portal?</p>{signOutError && <p className={styles.error} role="alert">{signOutError}</p>}<div className={styles.formActions}><button type="button" disabled={signingOut} className={styles.secondaryButton} onClick={() => setShowSignOutConfirm(false)}>Cancel</button><button type="button" disabled={signingOut} className={styles.primaryButton} onClick={() => void handleSignOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div></section></div>}
  </div>;
}
