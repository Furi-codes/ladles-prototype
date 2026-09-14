import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import styles from "../volunteer.module.css";

export default function VolunteerHeader({ profile, onSignOut }: { profile: Profile | null; onSignOut: () => void }) {
  const name = profile?.full_name || "Volunteer";
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <><div className={styles.topAccent} /><header className={styles.topbar}><div className={styles.brand}><Image src="/Ladles-logo.png" alt="Ladles of Love" width={44} height={44} priority /><div><p className={styles.brandName}>LADLES OF LOVE</p><div className={styles.brandSub}>Volunteer portal</div></div></div><div className={styles.topActions}><Link href="/volunteer/profile" className={styles.account} aria-label="Open profile settings"><span className={styles.avatar}>{initials}</span><div className={styles.accountDetails}><span className={styles.accountName}>{name}</span>{profile?.email && <span className={styles.accountEmail}>{profile.email}</span>}</div></Link><button type="button" className={styles.signOut} onClick={onSignOut}>Sign out</button></div></header></>;
}
