"use client";
import styles from "../admin.module.css";
import Icon from "./Icon";

export default function TopHeader({ name = "Administrator", email = "", onSignOut, onMenu }: { name?: string; email?: string; onSignOut?: () => void; onMenu?: () => void }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AD";
  return <header className={styles.topbar}><button type="button" className={styles.mobileMenuButton} onClick={onMenu} aria-label="Open navigation"><Icon name="menu" size={17} /></button><div className={styles.topActions}><div className={styles.headerAccount}><div className={styles.headerAvatar}>{initials}</div><div className={styles.headerAccountDetails}><span className={styles.headerAccountName}>{name}</span>{email && <span className={styles.headerAccountEmail}>{email}</span>}</div></div>{onSignOut && <button type="button" className={styles.signOut} onClick={onSignOut}><Icon name="logout" size={15} /> Sign out</button>}</div></header>;
}
