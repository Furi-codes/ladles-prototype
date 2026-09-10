"use client";
import styles from "../admin.module.css";

const content: Record<string, { title: string; description: string }> = {
  Dashboard: { title: "Dashboard", description: "Monitor events, bookings, and volunteer attendance." },
  Events: { title: "Events", description: "Create and manage upcoming volunteer events." },
  Volunteers: { title: "Volunteers", description: "Review rosters and record attendance for each event." },
  "Corporate CSR": { title: "Corporate CSR", description: "Manage corporate volunteering partnerships and activity requests." },
  "Export Reports": { title: "Export Reports", description: "Generate attendance and activity reports for your organisation." },
  Settings: { title: "Settings", description: "Configure administration preferences and account settings." },
};

export default function PageHeader({ activeNav, action }: { activeNav: string; action?: React.ReactNode }) {
  const page = content[activeNav] ?? { title: activeNav, description: "Manage your administration workspace." };
  return <div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>{page.title}</h1><p className={styles.pageDescription}>{page.description}</p></div>{action}</div>;
}
