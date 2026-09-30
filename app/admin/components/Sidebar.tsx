"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";
import Icon from "./Icon";

type NavLink = { label: string; href: string; icon: "dashboard" | "calendar" | "users" | "building" | "activity" | "settings" };
const navLinks: NavLink[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" as const },
  { label: "Events", href: "/admin/events", icon: "calendar" as const },
  { label: "Volunteer rosters", href: "/admin/volunteers", icon: "users" as const },
];
const extraLinks: NavLink[] = [
  { label: "Corporate CSR", href: "/admin/csr", icon: "building" as const },
  { label: "Analytics & reports", href: "/admin/reports", icon: "activity" as const },
  { label: "Settings", href: "/admin/settings", icon: "settings" as const },
];

export default function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const renderLink = (link: NavLink) => {
    const active = pathname === link.href;
    return <Link key={link.href} href={link.href} className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`} onClick={onClose} aria-current={active ? "page" : undefined}><Icon name={link.icon} />{link.label}</Link>;
  };

  return <aside id="admin-mobile-navigation" className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`} role={isOpen ? "dialog" : undefined} aria-modal={isOpen ? true : undefined} aria-label="Administration navigation">
    <div className={styles.brand}><Image className="brandLogoImage" src="/Ladles-logo.png" alt="Ladles of Love" width={40} height={48} style={{ objectFit: "contain" }} /><div><div className={styles.brandName}>LADLES OF LOVE</div><div className={styles.brandSub}>Administration</div></div><button type="button" className={styles.sidebarClose} aria-label="Close navigation" onClick={onClose}><Icon name="close" /></button></div>
    <nav className={styles.nav} aria-label="Admin navigation"><div className={styles.navSection}>Admin workspace</div>{navLinks.map(renderLink)}<div className={styles.navSection} style={{ marginTop: 24 }}>Insights & organisation</div>{extraLinks.map(renderLink)}</nav>
    <div className={styles.sidebarFooter}>Small actions.<br /><strong>Lasting community impact.</strong></div>
  </aside>;
}
