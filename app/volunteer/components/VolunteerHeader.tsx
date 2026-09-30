"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useNavigationDrawer } from "@/app/components/useNavigationDrawer";
import type { Profile } from "@/lib/types";
import ThemeToggle from "@/app/components/ThemeToggle";
import styles from "../volunteer.module.css";
import ProfileAvatar from "./ProfileAvatar";
import VolunteerNavigation, { volunteerLinks } from "./VolunteerNavigation";

export default function VolunteerHeader({ profile, avatarUrl, onSignOut }: { profile: Profile | null; avatarUrl: string | null; onSignOut: () => void }) {
  const name = profile?.full_name || "Volunteer";
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useNavigationDrawer(menuOpen, () => setMenuOpen(false), "volunteer-mobile-menu", 1100);

  const closeMenu = () => setMenuOpen(false);
  const signOutFromMenu = () => {
    closeMenu();
    onSignOut();
  };

  return <>
    <div className={styles.topAccent} />
    <header className={styles.topbar}>
      <Link href="/volunteer" className={styles.brand} aria-label="Ladles of Love volunteer home"><Image className="brandLogoImage" src="/Ladles-logo.png" alt="" width={40} height={48} style={{ objectFit: "contain" }} priority /><div><p className={styles.brandName}>LADLES OF LOVE</p><div className={styles.brandSub}>Volunteer portal</div></div></Link>
      <VolunteerNavigation />
      <div className={styles.topActions}>
        <div className={styles.desktopActions}><ThemeToggle /><Link href="/volunteer/profile" className={styles.account} aria-label="Open profile settings"><ProfileAvatar name={name} src={avatarUrl} /><div className={styles.accountDetails}><span className={styles.accountName}>{name}</span>{profile?.email && <span className={styles.accountEmail}>{profile.email}</span>}</div></Link><button type="button" className={styles.signOut} onClick={onSignOut}>Sign out</button></div>
        <button type="button" className={styles.mobileMenuButton} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="volunteer-mobile-menu" onClick={() => setMenuOpen((open) => !open)}><span /><span /><span /></button>
      </div>
    </header>
    {menuOpen && <>
      <button type="button" className={styles.mobileMenuBackdrop} aria-label="Close menu" onClick={closeMenu} />
      <aside id="volunteer-mobile-menu" className={styles.mobileMenu} role="dialog" aria-modal="true" aria-label="Volunteer navigation">
        <div className={styles.mobileMenuHeading}><span>Menu</span><button type="button" className={styles.mobileMenuClose} aria-label="Close menu" onClick={closeMenu}>{"\u00d7"}</button></div>
        {volunteerLinks.map(link => <Link key={link.href} href={link.href} className={styles.mobileNavLink} aria-current={pathname === link.href ? "page" : undefined} onClick={closeMenu}>{link.label}</Link>)}
        <div className={styles.mobileAccount}><ProfileAvatar name={name} src={avatarUrl} size={42} /><div><strong>{name}</strong>{profile?.email && <span>{profile.email}</span>}</div></div>
        <div className={styles.mobileMenuActions}><ThemeToggle /><button type="button" className={styles.signOut} onClick={signOutFromMenu}>Sign out</button></div>
      </aside>
    </>}
  </>;
}
