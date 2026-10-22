"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignOut } from "@/app/components/useSignOut";
import { useSessionBoundary } from "@/app/components/useSessionBoundary";
import styles from "../volunteer.module.css";
import { VolunteerAccountContext } from "./VolunteerAccountContext";
import VolunteerHeader from "./VolunteerHeader";
import VolunteerNavigation from "./VolunteerNavigation";
import VolunteerLoadingScreen from "./VolunteerLoadingScreen";
import ToastContainer from "./ToastContainer";
import ConfirmDialog from "./ConfirmDialog";
import { useVolunteerData } from "./VolunteerProvider";

export default function VolunteerShell({ children }: { children: React.ReactNode }) {
  const { signOut: handleSignOut, busy: signingOut, error: signOutError } = useSignOut();
  const { profile, avatarUrl, isCheckingAccess, loadError, toasts } = useVolunteerData(); const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const sessionEnded = useSessionBoundary(!isCheckingAccess);
  if (sessionEnded) return <div className={`portalUi ${styles.shell}`}><main className={styles.content}><h1>Your session has changed</h1><p>Sign in again to load your current profile and bookings. Previous account details have been hidden.</p><Link className={styles.primaryButton} href="/">Continue to sign in</Link></main></div>;
  if (isCheckingAccess) return <VolunteerLoadingScreen message="Checking volunteer access..." />;
  return <div className={`portalUi ${styles.shell}`}><a className="portalSkipLink" href="#volunteer-content">Skip to content</a><VolunteerHeader profile={profile} avatarUrl={avatarUrl} onSignOut={() => setShowSignOutConfirm(true)} /><main id="volunteer-content" tabIndex={-1} className={styles.content}>{loadError && <div className={styles.error} role="alert">{loadError}</div>}<VolunteerAccountContext.Provider value={() => setShowSignOutConfirm(true)}>{children}</VolunteerAccountContext.Provider></main><VolunteerNavigation mobile /><ToastContainer toasts={toasts} />{showSignOutConfirm && <ConfirmDialog title="Sign out?" message="Are you sure you want to sign out of the volunteer portal?" confirmLabel={signingOut ? "Signing out…" : "Sign out"} busy={signingOut} error={signOutError} onCancel={() => setShowSignOutConfirm(false)} onConfirm={handleSignOut} />}</div>;
}
