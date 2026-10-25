"use client";
/**
 * Renders the shared admin page title, description and optional actions.
 * Keeping this small layout in one component gives feature pages the same heading structure.
 */

import styles from "@/styles/admin.module.css";

const content: Record<string, { title: string; description: string }> = {
  Dashboard: { title: "Dashboard", description: "Monitor events, bookings, and volunteer attendance." },
  Events: { title: "Volunteer events", description: "Create and manage upcoming volunteer events." },
  "Volunteer rosters": { title: "Volunteer rosters", description: "Manage event participants, attendance, and recorded hours." },
  "Corporate CSR": { title: "Corporate CSR", description: "Manage corporate volunteering partnerships and activity requests." },
  "Analytics & Reports": { title: "Volunteer analytics & reports", description: "Volunteer participation, attendance and verified hours. Company results are available under Corporate analytics." },
  Settings: { title: "Settings", description: "Configure administration preferences and account settings." },
};

export default function PageHeader({ activeNav, action }: { activeNav: string; action?: React.ReactNode }) {
  const page = content[activeNav] ?? { title: activeNav, description: "Manage your administration workspace." };
  return <div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>{page.title}</h1><p className={styles.pageDescription}>{page.description}</p></div>{action}</div>;
}
