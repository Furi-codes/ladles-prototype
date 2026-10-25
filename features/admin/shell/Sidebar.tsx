"use client";
/**
 * Groups the admin links into volunteer features, corporate features and settings.
 * Navigation uses the current pathname to indicate the active screen.
 */

import PortalBrand from "@/components/branding/PortalBrand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/admin.module.css";
import Icon from "@/components/ui/Icon";
import { corporateRolloutEnabled, corporateBookingsEnabled, corporateOutcomesEnabled } from "@/lib/config/features";

type NavLink = { label: string; href: string; icon: "dashboard" | "calendar" | "users" | "building" | "activity" | "settings" };
const volunteerLinks: NavLink[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" as const },
  { label: "Volunteer events", href: "/admin/events", icon: "calendar" as const },
  { label: "Volunteer rosters", href: "/admin/volunteers", icon: "users" as const },
  ...(corporateRolloutEnabled ? [{ label: "Volunteer directory", href: "/admin/directory", icon: "users" as const }] : []),
  { label: "Volunteer analytics", href: "/admin/reports", icon: "activity" as const },
];
const corporateLinks: NavLink[] = [
  ...(corporateBookingsEnabled ? [{ label: "Corporate bookings", href: "/admin/corporate-bookings", icon: "building" as const }] : []),
  ...(corporateRolloutEnabled ? [{ label: "Corporate accounts", href: "/admin/corporate-accounts", icon: "building" as const }] : []),
  ...(corporateOutcomesEnabled ? [{ label: "Corporate analytics", href: "/admin/corporate-reports", icon: "activity" as const }] : []),
];

export default function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const renderLink = (link: NavLink) => {
    const active = pathname === link.href;
    return <Link key={link.href} href={link.href} className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`} onClick={onClose} aria-current={active ? "page" : undefined}><Icon name={link.icon} />{link.label}</Link>;
  };

  return <aside id="admin-mobile-navigation" className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`} role={isOpen ? "dialog" : undefined} aria-modal={isOpen ? true : undefined} aria-label="Administration navigation">
    <div className={styles.brand}><PortalBrand portal="Administration" /><button type="button" className={styles.sidebarClose} aria-label="Close navigation" onClick={onClose}><Icon name="close" /></button></div>
    <nav className={styles.nav} aria-label="Admin navigation">
      <div className={styles.navGroup} role="group" aria-labelledby="volunteer-navigation-title"><div id="volunteer-navigation-title" className={styles.navSection}>Volunteers</div>{volunteerLinks.map(renderLink)}</div>
      {corporateLinks.length > 0 && <div className={styles.navGroup} role="group" aria-labelledby="corporate-navigation-title"><div id="corporate-navigation-title" className={styles.navSection}>Corporate</div>{corporateLinks.map(renderLink)}</div>}
      <div className={styles.navUtility}>{renderLink({ label: 'Settings', href: '/admin/settings', icon: 'settings' })}</div>
    </nav>
    <div className={styles.sidebarFooter}>Small actions.<br /><strong>Lasting community impact.</strong></div>
  </aside>;
}
