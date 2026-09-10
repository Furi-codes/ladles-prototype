import type { Booking } from "@/lib/types";
import styles from "../volunteer.module.css";

export default function ProgressionPanel({ bookings, userId }: { bookings: Booking[]; userId: string | undefined }) {
  const completed = bookings.filter((booking) => booking.user_id === userId && booking.status === "Completed");
  return <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>My progression</h2><p className={styles.cardHint}>Completed events are recorded by the administration team.</p></div></div><table className={styles.table}><thead><tr><th>Progress</th><th>Total</th></tr></thead><tbody><tr><td>Hours volunteered</td><td className={styles.progressValue}>{completed.length * 2} hours</td></tr><tr><td>Events completed</td><td className={styles.progressValue}>{completed.length}</td></tr></tbody></table><div className={styles.progressFooter}><span className={styles.progressNote}>Hours use the current two-hour-per-event estimate.</span><button type="button" className={styles.secondaryButton} onClick={() => window.print()}>Print progression</button></div></section>;
}
