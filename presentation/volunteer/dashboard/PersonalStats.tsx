/**
 * Shows the volunteer's verified contribution totals.
 * The shared attendance helper calculates these figures from supplied rows, without another
 * database query.
 */

import { formatWorkedTime, getVerifiedContribution } from '@/business/shared/dates/attendance';
import type { AttendanceRecord, Booking } from '@/business/shared/types';
import ui from '@/presentation/styles/experience.module.css';
import AnimatedNumber from '@/presentation/components/experience/AnimatedNumber';

export default function PersonalStats({ bookings, attendance, userId, activeCount, loading }: { bookings: Booking[]; attendance: AttendanceRecord[]; userId?: string; activeCount: number; loading: boolean }) {
  const { completed, totalMinutes: minutes } = getVerifiedContribution(bookings, attendance, userId);
  return <section className={ui.stats} aria-label="Your volunteering at a glance" aria-busy={loading}>
    {[["Verified hours", formatWorkedTime(minutes), "Across completed shifts"], ["Completed shifts", completed.length, "Thank you for giving your time"], ["Active bookings", activeCount, "Reserved and in-progress shifts"]].map(([label, value, hint]) => <article key={label} className={ui.stat}><span>{label}</span><strong>{loading ? '…' : typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</strong><small>{hint}</small></article>)}
  </section>;
}
