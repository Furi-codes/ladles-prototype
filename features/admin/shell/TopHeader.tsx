"use client";
/**
 * Shows the admin breadcrumb, inbox, theme switch and signed-in identity.
 * Account actions stay in the workspace header while feature actions stay with their own pages.
 */

import styles from "@/styles/admin.module.css";
import Icon from "@/components/ui/Icon";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { usePathname } from "next/navigation";
import { corporateRolloutEnabled } from "@/lib/config/features";
import AdminNotificationBell from '@/features/admin/notifications/AdminNotificationBell';

const pageLabels: Record<string, string> = {
  "/admin/corporate-bookings": "Corporate bookings",
  "/admin/corporate-reports": "Corporate analytics",
  "/admin/directory": "Volunteer directory", "/admin/corporate-accounts": "Corporate accounts",
  "/admin": "Dashboard", "/admin/events": "Volunteer events", "/admin/volunteers": "Volunteer rosters",
  "/admin/notifications": "Notifications", "/admin/reports": "Volunteer analytics", "/admin/settings": "Settings",
};

export default function TopHeader({ name = "Administrator", email = "", onSignOut, onMenu, menuOpen = false }: { name?: string; email?: string; onSignOut?: () => void; onMenu?: () => void; menuOpen?: boolean }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AD";
  const pathname = usePathname();
  return <header className={styles.topbar}><button type="button" className={styles.mobileMenuButton} onClick={onMenu} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="admin-mobile-navigation" aria-expanded={menuOpen}><Icon name="menu" size={19} /></button><p className={styles.crumb}>Workspace <span aria-hidden="true">/</span> <strong key={pathname}>{pageLabels[pathname] ?? "Administration"}</strong></p><div className={styles.topActions}>{corporateRolloutEnabled && <AdminNotificationBell />}<ThemeToggle /><div className={styles.headerAccount}><div className={styles.headerAvatar}>{initials}</div><div className={styles.headerAccountDetails}><span className={styles.headerAccountName}>{name}</span>{email && <span className={styles.headerAccountEmail}>{email}</span>}</div></div>{onSignOut && <button type="button" className={styles.signOut} onClick={onSignOut}><Icon name="logout" size={15} /> Sign out</button>}</div></header>;
}
