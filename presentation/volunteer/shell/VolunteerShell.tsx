"use client";

/**
 * Keeps the volunteer workspace and account boundary around its pages.
 * Navigation changes reuse this layout instead of rebuilding the header for every feature.
 */

import { useState } from "react";
import Link from "next/link";
import { useSignOut } from "@/presentation/hooks/useSignOut";
import { useSessionBoundary } from "@/presentation/hooks/useSessionBoundary";
import styles from "@/presentation/styles/volunteer.module.css";
import { VolunteerAccountContext } from "@/presentation/volunteer/shell/VolunteerAccountContext";
import VolunteerHeader from "@/presentation/volunteer/shell/VolunteerHeader";
import VolunteerNavigation from "@/presentation/volunteer/shell/VolunteerNavigation";
import VolunteerLoadingScreen from "@/presentation/volunteer/shell/VolunteerLoadingScreen";
import ToastContainer from "@/presentation/volunteer/notifications/ToastContainer";
import ConfirmDialog from "@/presentation/components/ui/ConfirmDialog";
import { useVolunteerData } from "@/presentation/volunteer/shell/VolunteerProvider";
import { usePortalMotion } from '@/presentation/components/experience/usePortalMotion';

export default function VolunteerShell({ children }: { children: React.ReactNode }) {
  const { signOut: handleSignOut, busy: signingOut, error: signOutError } = useSignOut();
  const { profile, avatarUrl, isCheckingAccess, loadError, toasts } = useVolunteerData(); const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const sessionEnded = useSessionBoundary(!isCheckingAccess);
  const motionRoot = usePortalMotion(!isCheckingAccess && !sessionEnded);
  if (sessionEnded) return <div className={`portalUi ${styles.shell}`}><main className={styles.content}><h1>Your session has changed</h1><p>Sign in again to load your current profile and bookings. Previous account details have been hidden.</p><Link className={styles.primaryButton} href="/">Continue to sign in</Link></main></div>;
  if (isCheckingAccess) return <VolunteerLoadingScreen message="Checking volunteer access..." />;
  return <div ref={motionRoot} data-experience="volunteer" className={`portalUi ${styles.shell}`}><a className="portalSkipLink" href="#volunteer-content">Skip to content</a><VolunteerHeader profile={profile} avatarUrl={avatarUrl} onSignOut={() => setShowSignOutConfirm(true)} /><main id="volunteer-content" tabIndex={-1} className={styles.content}>{loadError && <div className={styles.error} role="alert">{loadError}</div>}<VolunteerAccountContext.Provider value={() => setShowSignOutConfirm(true)}>{children}</VolunteerAccountContext.Provider></main><VolunteerNavigation mobile /><ToastContainer toasts={toasts} />{showSignOutConfirm && <ConfirmDialog title="Sign out?" message="Are you sure you want to sign out of the volunteer portal?" confirmLabel={signingOut ? "Signing out…" : "Sign out"} busy={signingOut} error={signOutError} onCancel={() => setShowSignOutConfirm(false)} onConfirm={handleSignOut} />}</div>;
}
