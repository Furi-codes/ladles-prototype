"use client";

import PortalBrand from "@/app/components/PortalBrand";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import ThemeToggle from "@/app/components/ThemeToggle";
import styles from "../volunteer.module.css";
import ProfileAvatar from "./ProfileAvatar";
import VolunteerNavigation from "./VolunteerNavigation";
import NotificationBell from "./NotificationBell";
import PortalContactButton from "@/app/components/PortalContactButton";

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
