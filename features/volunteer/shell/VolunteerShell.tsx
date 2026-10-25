"use client";
/**
 * Keeps the volunteer workspace and account boundary around its pages.
 * Navigation changes reuse this layout instead of rebuilding the header for every feature.
 */

import { useState } from "react";
import Link from "next/link";
import { useSignOut } from "@/hooks/useSignOut";
import { useSessionBoundary } from "@/hooks/useSessionBoundary";
import styles from "@/styles/volunteer.module.css";
import { VolunteerAccountContext } from "@/features/volunteer/shell/VolunteerAccountContext";
import VolunteerHeader from "@/features/volunteer/shell/VolunteerHeader";
import VolunteerNavigation from "@/features/volunteer/shell/VolunteerNavigation";
import VolunteerLoadingScreen from "@/features/volunteer/shell/VolunteerLoadingScreen";
import ToastContainer from "@/features/volunteer/notifications/ToastContainer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useVolunteerData } from "@/features/volunteer/shell/VolunteerProvider";

export default function VolunteerShell({ children }: { children: React.ReactNode }) {
  const { signOut: handleSignOut, busy: signingOut, error: signOutError } = useSignOut();
  const { profile, avatarUrl, isCheckingAccess, loadError, toasts } = useVolunteerData(); const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const sessionEnded = useSessionBoundary(!isCheckingAccess);
  if (sessionEnded) return <div className={`portalUi ${styles.shell}`}><main className={styles.content}><h1>Your session has changed</h1><p>Sign in again to load your current profile and bookings. Previous account details have been hidden.</p><Link className={styles.primaryButton} href="/">Continue to sign in</Link></main></div>;
  if (isCheckingAccess) return <VolunteerLoadingScreen message="Checking volunteer access..." />;
  return <div className={`portalUi ${styles.shell}`}><a className="portalSkipLink" href="#volunteer-content">Skip to content</a><VolunteerHeader profile={profile} avatarUrl={avatarUrl} onSignOut={() => setShowSignOutConfirm(true)} /><main id="volunteer-content" tabIndex={-1} className={styles.content}>{loadError && <div className={styles.error} role="alert">{loadError}</div>}<VolunteerAccountContext.Provider value={() => setShowSignOutConfirm(true)}>{children}</VolunteerAccountContext.Provider></main><VolunteerNavigation mobile /><ToastContainer toasts={toasts} />{showSignOutConfirm && <ConfirmDialog title="Sign out?" message="Are you sure you want to sign out of the volunteer portal?" confirmLabel={signingOut ? "Signing out…" : "Sign out"} busy={signingOut} error={signOutError} onCancel={() => setShowSignOutConfirm(false)} onConfirm={handleSignOut} />}</div>;
}
