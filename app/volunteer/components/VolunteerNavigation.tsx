"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PortalNavIcon from "@/app/components/PortalNavIcon";
import styles from "../volunteer.module.css";

export const volunteerLinks = [
  { href: "/volunteer", label: "Home", icon: "home" },
  { href: "/volunteer/impact", label: "My impact", icon: "impact" },
  { href: "/volunteer/attendance", label: "Attendance", icon: "scan" },
  { href: "/volunteer/profile", label: "Profile", icon: "profile" },
] as const;

export default function VolunteerNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <nav className={mobile ? styles.bottomNavigation : styles.desktopNavigation} aria-label={mobile ? "Mobile volunteer navigation" : "Volunteer navigation"}>
    {volunteerLinks.map(({ href, label, icon }) => <Link key={href} href={href} className={styles.portalNavLink} aria-current={pathname === href ? "page" : undefined}>
      {mobile && <PortalNavIcon name={icon} />}<span>{label}</span>
    </Link>)}
  </nav>;
}
