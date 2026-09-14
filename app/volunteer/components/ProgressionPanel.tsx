import { formatWorkedTime } from "@/lib/attendance-utils";
import type { AttendanceRecord, Booking } from "@/lib/types";
import styles from "../volunteer.module.css";

export default function ProgressionPanel({ bookings, attendanceRecords, userId }: { bookings: Booking[]; attendanceRecords: AttendanceRecord[]; userId: string | undefined }) {
  const completed = bookings.filter((booking) => booking.user_id === userId && booking.status === "Completed");
  const completedIds = new Set(completed.map((booking) => booking.id));
  const totalMinutes = attendanceRecords.filter((record) => completedIds.has(record.booking_id)).reduce((total, record) => total + (record.worked_minutes ?? 0), 0);
  const noShows = bookings.filter((booking) => booking.user_id === userId && booking.status === "No show").length;
  const incomplete = bookings.filter((booking) => booking.user_id === userId && booking.status === "Present").length;

  return <section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>My progression</h2><p className={styles.cardHint}>Hours come directly from your recorded clock-in and clock-out times.</p></div></div><table className={styles.table}><thead><tr><th>Progress</th><th>Total</th></tr></thead><tbody><tr><td>Hours volunteered</td><td className={styles.progressValue}>{formatWorkedTime(totalMinutes)}</td></tr><tr><td>Events completed</td><td className={styles.progressValue}>{completed.length}</td></tr><tr><td>No-shows</td><td className={styles.progressValue}>{noShows}</td></tr>{incomplete > 0 && <tr><td>Clock-out needed</td><td className={styles.progressValue}>{incomplete}</td></tr>}</tbody></table><div className={styles.progressFooter}><span className={styles.progressNote}>A shift counts only after its clock-out is recorded.</span><button type="button" className={styles.secondaryButton} onClick={() => window.print()}>Print progression</button></div></section>;
}
