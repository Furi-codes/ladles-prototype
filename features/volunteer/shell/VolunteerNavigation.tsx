"use client";
/**
 * Defines the volunteer portal navigation links.
 * The pathname identifies the active link, and the same links can be used in the mobile drawer.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import PortalNavIcon from "@/components/navigation/PortalNavIcon";
import styles from "@/styles/volunteer.module.css";

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
