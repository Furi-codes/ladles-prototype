"use client";
/**
 * Shows volunteer navigation, contacts, notifications and account controls.
 * Desktop and mobile navigation use the same destinations while the shell owns drawer state.
 */

import PortalBrand from "@/components/branding/PortalBrand";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "@/styles/volunteer.module.css";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import VolunteerNavigation from "@/features/volunteer/shell/VolunteerNavigation";
import NotificationBell from "@/features/volunteer/notifications/NotificationBell";
import PortalContactButton from "@/components/contacts/PortalContactButton";

export default function VolunteerHeader({ profile, avatarUrl, onSignOut }: { profile: Profile | null; avatarUrl: string | null; onSignOut: () => void }) {
  const name = profile?.full_name || "Volunteer";

  return <>
    <div className={styles.topAccent} />
    <header className={styles.topbar}>
      <Link href="/volunteer" className={styles.brand} aria-label="Ladles of Love volunteer home"><PortalBrand portal="Volunteer portal" /></Link>
      <VolunteerNavigation />
      <div className={styles.topActions}>
        {profile && <PortalContactButton portal="volunteer" />}
        <NotificationBell />
        <div className={styles.desktopActions}><ThemeToggle /><Link href="/volunteer/profile" className={styles.account} aria-label="Open profile settings"><ProfileAvatar name={name} src={avatarUrl} /><div className={styles.accountDetails}><span className={styles.accountName}>{name}</span>{profile?.email && <span className={styles.accountEmail}>{profile.email}</span>}</div></Link><button type="button" className={styles.signOut} onClick={onSignOut}>Sign out</button></div>
      </div>
    </header>
  </>;
}
