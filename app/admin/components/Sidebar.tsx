"use client";
import Image from "next/image";
import styles from "../admin.module.css";
import Icon from "./Icon";

export type AdminNav = "Dashboard" | "Manage Events" | "Volunteers" | "Corporate CSR" | "Export Reports" | "Settings";
const navLinks: { label: AdminNav; icon: "dashboard" | "calendar" | "users" | "building" | "download" | "settings" }[] = [
  { label: "Dashboard", icon: "dashboard" },
  { label: "Manage Events", icon: "calendar" },
  { label: "Volunteers", icon: "users" },
  { label: "Corporate CSR", icon: "building" },
  { label: "Export Reports", icon: "download" },
  { label: "Settings", icon: "settings" },
];

export default function Sidebar({ activeNav, setActiveNav, name = "Administrator", email = "", isOpen = false, onClose }: { activeNav: AdminNav; setActiveNav: (nav: AdminNav) => void; name?: string; email?: string; isOpen?: boolean; onClose?: () => void }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AD";
  return <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
    <div className={styles.brand}><Image src="/newLogo.png" alt="Ladles of Love" width={68} height={42} style={{ objectFit: "contain" }} /><div><div className={styles.brandName}>Ladles of Love</div><div className={styles.brandSub}>Administration</div></div></div>
    <nav className={styles.nav} aria-label="Admin navigation"><div className={styles.navSection}>Workspace</div>{navLinks.slice(0, 3).map((link) => { const active = activeNav === link.label; return <button key={link.label} type="button" className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`} onClick={() => { setActiveNav(link.label); onClose?.(); }} aria-current={active ? "page" : undefined}><Icon name={link.icon} />{link.label}</button>; })}<div className={styles.navSection} style={{ marginTop: 24 }}>More</div>{navLinks.slice(3).map((link) => { const active = activeNav === link.label; return <button key={link.label} type="button" className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`} onClick={() => { setActiveNav(link.label); onClose?.(); }} aria-current={active ? "page" : undefined}><Icon name={link.icon} />{link.label}</button>; })}</nav>
    <div className={styles.account}><div className={styles.avatar}>{initials}</div><div style={{ minWidth: 0 }}><div className={styles.accountName}>{name}</div><div className={styles.accountRole}>{email || "Administrator"}</div></div></div>
  </aside>;
}
