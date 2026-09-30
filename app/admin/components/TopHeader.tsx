"use client";
import styles from "../admin.module.css";
import Icon from "./Icon";
import ThemeToggle from "@/app/components/ThemeToggle";
import { usePathname } from "next/navigation";

const pageLabels: Record<string, string> = {
  "/admin": "Dashboard", "/admin/events": "Events", "/admin/volunteers": "Volunteer rosters",
  "/admin/csr": "Corporate CSR", "/admin/reports": "Analytics & reports", "/admin/settings": "Settings",
};

export default function TopHeader({ name = "Administrator", email = "", onSignOut, onMenu, menuOpen = false }: { name?: string; email?: string; onSignOut?: () => void; onMenu?: () => void; menuOpen?: boolean }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AD";
  const pathname = usePathname();
  return <header className={styles.topbar}><button type="button" className={styles.mobileMenuButton} onClick={onMenu} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="admin-mobile-navigation" aria-expanded={menuOpen}><Icon name="menu" size={19} /></button><p className={styles.crumb}>Workspace <span aria-hidden="true">/</span> <strong>{pageLabels[pathname] ?? "Administration"}</strong></p><div className={styles.topActions}><ThemeToggle /><div className={styles.headerAccount}><div className={styles.headerAvatar}>{initials}</div><div className={styles.headerAccountDetails}><span className={styles.headerAccountName}>{name}</span>{email && <span className={styles.headerAccountEmail}>{email}</span>}</div></div>{onSignOut && <button type="button" className={styles.signOut} onClick={onSignOut}><Icon name="logout" size={15} /> Sign out</button>}</div></header>;
}
