"use client";

/**
 * Groups the admin links into volunteer features, corporate features and settings.
 * Navigation uses the current pathname to indicate the active screen.
 */

import PortalBrand from "@/presentation/components/branding/PortalBrand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/presentation/styles/admin.module.css";
import Icon from "@/presentation/components/ui/Icon";
import { corporateRolloutEnabled, corporateBookingsEnabled, corporateOutcomesEnabled } from "@/business/shared/config/features";
import ActivePill from '@/presentation/components/experience/ActivePill';

type NavLink = { label: string; href: string };
const volunteerLinks: NavLink[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Volunteer events", href: "/admin/events" },
  { label: "Volunteer rosters", href: "/admin/volunteers" },
  ...(corporateRolloutEnabled ? [{ label: "Volunteer directory", href: "/admin/directory" }] : []),
  { label: "Volunteer analytics", href: "/admin/reports" },
];
const corporateLinks: NavLink[] = [
  ...(corporateBookingsEnabled ? [{ label: "Corporate bookings", href: "/admin/corporate-bookings" }] : []),
  ...(corporateRolloutEnabled ? [{ label: "Corporate accounts", href: "/admin/corporate-accounts" }] : []),
  ...(corporateOutcomesEnabled ? [{ label: "Corporate analytics", href: "/admin/corporate-reports" }] : []),
];

export default function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const renderLink = (link: NavLink) => {
    const active = pathname === link.href;
    return <Link key={link.href} href={link.href} className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`} onClick={onClose} aria-current={active ? "page" : undefined}>{active && <ActivePill group="admin-sidebar" />}<span>{link.label}</span></Link>;
  };

  return <aside id="admin-mobile-navigation" className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`} role={isOpen ? "dialog" : undefined} aria-modal={isOpen ? true : undefined} aria-label="Administration navigation">
    <div className={styles.brand}><PortalBrand portal="Administration" /><button type="button" className={styles.sidebarClose} aria-label="Close navigation" onClick={onClose}><Icon name="close" /></button></div>
    <nav className={styles.nav} aria-label="Admin navigation">
      <div className={styles.navGroup} role="group" aria-labelledby="volunteer-navigation-title"><div id="volunteer-navigation-title" className={styles.navSection}>Volunteers</div>{volunteerLinks.map(renderLink)}</div>
      {corporateLinks.length > 0 && <div className={styles.navGroup} role="group" aria-labelledby="corporate-navigation-title"><div id="corporate-navigation-title" className={styles.navSection}>Corporate</div>{corporateLinks.map(renderLink)}</div>}
      <div className={styles.navUtility}>{renderLink({ label: 'Settings', href: '/admin/settings' })}</div>
    </nav>
    <div className={styles.sidebarFooter}>Small actions.<br /><strong>Lasting community impact.</strong></div>
  </aside>;
}
