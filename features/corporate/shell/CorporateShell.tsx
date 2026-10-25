"use client";
/**
 * Connects the corporate frame to the shared account/session state.
 * The layout keeps the workspace mounted while individual feature pages change.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { corporateRolloutEnabled } from '@/lib/config/features';
import CorporateFrame from '@/features/corporate/shell/CorporateFrame';
import CorporateLoadingScreen from '@/features/corporate/shell/CorporateLoadingScreen';
import CorporateContentLoading from '@/features/corporate/shell/CorporateContentLoading';
import { CorporateWorkspaceProvider, useCorporateWorkspace } from '@/features/corporate/shell/CorporateWorkspaceProvider';
import styles from '@/styles/volunteer.module.css';

export default function CorporateShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Public registration shares the sign-in layout and must not run signed-in workspace checks.
  if (pathname === '/corporate/register') return <>{children}</>;
  if (!corporateRolloutEnabled) return <CorporateFrame><h1>Corporate access is not enabled yet</h1><Link href="/">Back to sign in</Link></CorporateFrame>;
  return <CorporateWorkspaceProvider><WorkspaceShell pathname={pathname}>{children}</WorkspaceShell></CorporateWorkspaceProvider>;
}
function WorkspaceShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const { data, checking, refreshing, error, sessionEnded, refreshWorkspace, photo } = useCorporateWorkspace();
  useEffect(() => { void refreshWorkspace(); }, [pathname, refreshWorkspace]);
  if (checking) return <CorporateLoadingScreen />;
  const content = sessionEnded ? <section role="alert"><h1 className={styles.pageTitle}>Your session has changed</h1><p>Sign in again to load the correct business account. Previous account details have been hidden.</p><Link className={styles.primaryButton} href="/">Continue to sign in</Link></section>
    : data ? children : !error ? <CorporateContentLoading message="Opening your account…" /> : null;
  return <CorporateFrame signedIn={Boolean(data) && !sessionEnded} workflowAccess={Boolean(data?.account.status === 'Approved' && data.emailVerified)} account={data?.account} signInEmail={data?.signInEmail} avatarUrl={photo?.avatarUrl}>
    {refreshing && data && <p className={styles.cardHint} role="status">Checking for account updates…</p>}
    {error && <div className={styles.error} role="alert">{error}<button className={styles.secondaryButton} disabled={refreshing} onClick={() => void refreshWorkspace(true)}>Retry</button></div>}
    {content}
  </CorporateFrame>;
}
