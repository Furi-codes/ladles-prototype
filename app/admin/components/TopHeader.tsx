"use client";
import styles from "../admin.module.css";
import Icon from "./Icon";

export default function TopHeader({ activeNav, onSignOut, adminName, onMenu }: { activeNav: string; onSignOut?: () => void; adminName?: string; onMenu?: () => void }) {
  return <header className={styles.topbar}><button type="button" className={styles.mobileMenuButton} onClick={onMenu} aria-label="Open navigation"><Icon name="menu" size={17} /></button><div className={styles.crumb}>Administration <span aria-hidden="true">/</span> <strong>{activeNav === "Manage Events" ? "Events" : activeNav}</strong></div><div className={styles.topActions}><span className={styles.signedIn}>{adminName ? `Signed in as ${adminName}` : "Admin account"}</span>{onSignOut && <button type="button" className={styles.signOut} onClick={onSignOut}><Icon name="logout" size={15} /> Sign out</button>}</div></header>;
}
