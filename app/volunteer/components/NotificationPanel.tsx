import type { Notification } from "@/lib/types";
import styles from "../volunteer.module.css";

/** Displays important account updates, such as an event cancellation. */
export default function NotificationPanel({
  notifications,
  onDismiss,
}: {
  notifications: Notification[];
  onDismiss: (notificationId: number) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <section className={`${styles.card} ${styles.notificationPanel}`} aria-label="Important updates">
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Important updates</h2>
          <p className={styles.cardHint}>Changes to events you have signed up for.</p>
        </div>
        <span className={styles.eventCount}>{notifications.length}</span>
      </div>
      <div className={styles.notificationList}>
        {notifications.map((notification) => (
          <article className={styles.notificationItem} key={notification.id}>
            <div>
              <h3 className={styles.notificationTitle}>{notification.title}</h3>
              {notification.message && <p className={styles.notificationMessage}>{notification.message}</p>}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={() => onDismiss(notification.id)}>
              Dismiss
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
