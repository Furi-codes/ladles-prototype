"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "../volunteer.module.css";
import VolunteerHeader from "./VolunteerHeader";
import VolunteerLoadingScreen from "./VolunteerLoadingScreen";
import ToastContainer from "./ToastContainer";
import ConfirmDialog from "./ConfirmDialog";
import { useVolunteerData } from "./VolunteerProvider";

export default function VolunteerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const { profile, isCheckingAccess, loadError, toasts } = useVolunteerData(); const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  async function handleSignOut() { await supabase.auth.signOut(); router.replace("/"); }
  if (isCheckingAccess) return <VolunteerLoadingScreen message="Checking volunteer access..." />;
  return <div className={styles.shell}><VolunteerHeader profile={profile} onSignOut={() => setShowSignOutConfirm(true)} /><main className={styles.content}>{loadError && <div className={styles.error} role="alert">{loadError}</div>}{children}</main><ToastContainer toasts={toasts} />{showSignOutConfirm && <ConfirmDialog title="Sign out?" message="Are you sure you want to sign out of the volunteer portal?" confirmLabel="Sign out" onCancel={() => setShowSignOutConfirm(false)} onConfirm={handleSignOut} />}</div>;
}
