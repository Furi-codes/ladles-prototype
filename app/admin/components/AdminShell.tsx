"use client";

import { useState } from "react";
import { useNavigationDrawer } from "@/app/components/useNavigationDrawer";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "../admin.module.css";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { useAdminData } from "./AdminProvider";
import AdminLoadingScreen from "./AdminLoadingScreen";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { adminProfile, isCheckingAccess, loadError } = useAdminData();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useNavigationDrawer(mobileNavOpen, () => setMobileNavOpen(false), "admin-mobile-navigation", 760);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

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
    {showSignOutConfirm && <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sign-out-title"><h2 id="sign-out-title" className={styles.dialogTitle}>Sign out?</h2><p className={styles.dialogText}>Are you sure you want to sign out of the administration portal?</p><div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setShowSignOutConfirm(false)}>Cancel</button><button type="button" className={styles.primaryButton} onClick={handleSignOut}>Sign out</button></div></section></div>}
  </div>;
}
