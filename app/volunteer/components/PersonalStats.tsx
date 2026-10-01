import { formatWorkedTime } from '@/lib/attendance-utils';
import type { AttendanceRecord, Booking } from '@/lib/types';
import ui from './experience.module.css';

export default function PersonalStats({ bookings, attendance, userId, activeCount, loading }: { bookings: Booking[]; attendance: AttendanceRecord[]; userId?: string; activeCount: number; loading: boolean }) {
  const completed = bookings.filter(b => b.user_id === userId && b.status === 'Completed');
  const ids = new Set(completed.map(b => b.id));
  const minutes = attendance.filter(a => ids.has(a.booking_id)).reduce((sum, a) => sum + (a.worked_minutes ?? 0), 0);
  return <section className={ui.stats} aria-label="Your volunteering at a glance" aria-busy={loading}>
    {[["Verified hours", formatWorkedTime(minutes), "Across completed shifts"], ["Completed shifts", completed.length, "Thank you for giving your time"], ["Active bookings", activeCount, "Reserved and in-progress shifts"]].map(([label, value, hint]) => <article key={label} className={ui.stat}><span>{label}</span><strong>{loading ? '…' : value}</strong><small>{hint}</small></article>)}
  </section>;
}
