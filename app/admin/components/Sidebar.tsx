"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../admin.module.css";
import Icon from "./Icon";

type NavLink = { label: string; href: string; icon: "dashboard" | "calendar" | "users" | "building" | "download" | "settings" };
const navLinks: NavLink[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" as const },
  { label: "Manage Events", href: "/admin/events", icon: "calendar" as const },
  { label: "Volunteers", href: "/admin/volunteers", icon: "users" as const },
];
const extraLinks: NavLink[] = [
  { label: "Corporate CSR", href: "/admin/csr", icon: "building" as const },
  { label: "Export Reports", href: "/admin/reports", icon: "download" as const },
  { label: "Settings", href: "/admin/settings", icon: "settings" as const },
];

export default function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const renderLink = (link: NavLink) => {
    const active = pathname === link.href;
    return <Link key={link.href} href={link.href} className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`} onClick={onClose} aria-current={active ? "page" : undefined}><Icon name={link.icon} />{link.label}</Link>;
  };

  return <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
    <div className={styles.brand}><Image src="/newLogo.png" alt="Ladles of Love" width={68} height={42} style={{ objectFit: "contain" }} /><div><div className={styles.brandName}>Ladles of Love</div><div className={styles.brandSub}>Administration</div></div></div>
    <nav className={styles.nav} aria-label="Admin navigation"><div className={styles.navSection}>Workspace</div>{navLinks.map(renderLink)}<div className={styles.navSection} style={{ marginTop: 24 }}>More</div>{extraLinks.map(renderLink)}</nav>
  </aside>;
}
