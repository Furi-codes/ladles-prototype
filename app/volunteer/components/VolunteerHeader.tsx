import ProfileAvatar from "./ProfileAvatar";
import Image from "next/image";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import ThemeToggle from "@/app/components/ThemeToggle";
import styles from "../volunteer.module.css";

export default function VolunteerHeader({ profile, avatarUrl, onSignOut }: { profile: Profile | null; avatarUrl: string | null; onSignOut: () => void }) {
  const name = profile?.full_name || "Volunteer";
  return <><div className={styles.topAccent} /><header className={styles.topbar}><div className={styles.brand}><Image className="brandLogoImage" src="/Ladles-logo.png" alt="Ladles of Love" width={44} height={44} priority /><div><p className={styles.brandName}>LADLES OF LOVE</p><div className={styles.brandSub}>Volunteer portal</div></div></div><div className={styles.topActions}><ThemeToggle /><Link href="/volunteer/profile" className={styles.account} aria-label="Open profile settings"><ProfileAvatar name={name} src={avatarUrl} /><div className={styles.accountDetails}><span className={styles.accountName}>{name}</span>{profile?.email && <span className={styles.accountEmail}>{profile.email}</span>}</div></Link><button type="button" className={styles.signOut} onClick={onSignOut}>Sign out</button></div></header></>;
}
