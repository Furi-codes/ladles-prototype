/**
 * Opens the volunteer inbox at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import NotificationPanel from "@/presentation/volunteer/notifications/NotificationPanel";
import styles from "@/presentation/styles/volunteer.module.css";

export default function NotificationsPage() {
  return <><section className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Notifications</h1><p className={styles.pageDescription}>Stay up to date with your volunteering. Reminders are shown in this portal, not sent by email or SMS.</p></div></section><NotificationPanel /></>;
}
