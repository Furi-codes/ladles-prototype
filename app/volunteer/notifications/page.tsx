import NotificationPanel from "../components/NotificationPanel";
import styles from "../volunteer.module.css";

export default function NotificationsPage() {
  return <><section className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Notifications</h1><p className={styles.pageDescription}>Stay up to date with your volunteering. Reminders are shown in this portal, not sent by email or SMS.</p></div></section><NotificationPanel /></>;
}
