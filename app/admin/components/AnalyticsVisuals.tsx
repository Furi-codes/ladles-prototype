import type { CSSProperties } from "react";
import type { AttendanceRecord, Booking, CorporateBooking, Event, EventSlot } from "@/lib/types";
import styles from "../admin.module.css";

type AnalyticsData = {
  events: Event[];
  slots: EventSlot[];
  bookings: Booking[];
  attendance: AttendanceRecord[];
  corporate: CorporateBooking[];
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function localWeekday(date: string) {
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}

function shortHour(time: string) {
  return time.slice(0, 5);
}

export function AnalyticsOverview({ data }: { data: AnalyticsData }) {
  const attendanceByBooking = new Set(data.attendance.filter((record) => record.clocked_in_at).map((record) => record.booking_id));
  const byCategory = new Map<string, { attendance: number; hours: number; events: number }>();

  for (const event of data.events.filter((item) => item.status !== "Cancelled")) {
    const category = event.category || "Other";
    const current = byCategory.get(category) ?? { attendance: 0, hours: 0, events: 0 };
    const eventBookings = data.bookings.filter((booking) => booking.event_id === event.id);
    const bookingIds = new Set(eventBookings.map((booking) => booking.id));
    const eventAttendance = data.attendance.filter((record) => bookingIds.has(record.booking_id));
    const corporate = data.corporate.filter((booking) => booking.event_id === event.id && booking.status === "Completed");
    current.events += 1;
    current.attendance += eventBookings.filter((booking) => attendanceByBooking.has(booking.id)).length + corporate.reduce((total, booking) => total + (booking.attendance_count ?? 0), 0);
    current.hours += eventAttendance.reduce((total, record) => total + (record.worked_minutes ?? 0), 0) / 60 + corporate.reduce((total, booking) => total + Number(booking.volunteer_hours ?? 0), 0);
    byCategory.set(category, current);
  }

  const categories = [...byCategory.entries()].sort((first, second) => second[1].attendance - first[1].attendance);
  const maximum = Math.max(1, ...categories.map(([, value]) => value.attendance));

  return <div className={styles.analyticsStack}>
    <section className={styles.card} aria-labelledby="category-comparison">
      <div className={styles.cardHeader}><div><h2 id="category-comparison" className={styles.cardTitle}>Participation by event category</h2><p className={styles.cardHint}>Recorded attendance and verified hours for the selected events.</p></div></div>
      <div className={styles.analyticsBody}>
        {categories.length ? <div className={styles.categoryList}>{categories.map(([category, value]) => <div className={styles.categoryRow} key={category}>
          <div className={styles.categoryLabel}><strong>{category}</strong><span>{value.events} event{value.events === 1 ? "" : "s"} · {value.hours.toFixed(1)} verified hours</span></div>
          <div className={styles.categoryBar} aria-label={`${category}: ${value.attendance} recorded attendees`}><span style={{ width: `${(value.attendance / maximum) * 100}%` }} /></div>
          <strong className={styles.categoryValue}>{value.attendance}</strong>
        </div>)}</div> : <p className={styles.empty}>No category data matches these filters.</p>}
      </div>
    </section>
  </div>;
}

export function AttendanceHeatmap({ data }: { data: AnalyticsData }) {
  const eventById = new Map(data.events.map((event) => [event.id, event]));
  const slotById = new Map(data.slots.map((slot) => [slot.id, slot]));
  const checkedIn = new Set(data.attendance.filter((record) => record.clocked_in_at).map((record) => record.booking_id));
  const times = [...new Set(data.slots.map((slot) => shortHour(slot.start_time)))].sort();
  const values = new Map<string, number>();
  const add = (eventId: number, slotId: number | null | undefined, amount: number) => {
    const event = eventById.get(eventId);
    const slot = slotId ? slotById.get(slotId) : undefined;
    if (!event || !slot || event.status === "Cancelled") return;
    const key = `${localWeekday(event.date)}-${shortHour(slot.start_time)}`;
    values.set(key, (values.get(key) ?? 0) + amount);
  };

  for (const booking of data.bookings) if (checkedIn.has(booking.id)) add(booking.event_id, booking.event_slot_id, 1);
  for (const booking of data.corporate) if (booking.status === "Completed") add(booking.event_id, booking.event_slot_id, booking.attendance_count ?? 0);
  const maximum = Math.max(1, ...values.values());
  const cellStyle = (count: number): CSSProperties => ({ backgroundColor: `rgba(217, 39, 50, ${count ? 0.12 + (count / maximum) * 0.78 : 0.035})`, color: count / maximum > 0.58 ? "#fff" : "#7b2027" });

  return <section className={styles.card} aria-labelledby="attendance-heatmap">
    <div className={styles.cardHeader}><div><h2 id="attendance-heatmap" className={styles.cardTitle}>Attendance heatmap</h2><p className={styles.cardHint}>Recorded attendance by event weekday and shift start time. Darker cells indicate more attendees.</p></div></div>
    <div className={styles.heatmapWrap}>
      {times.length ? <table className={styles.heatmapTable}><thead><tr><th scope="col">Day</th>{times.map((time) => <th key={time} scope="col">{time}</th>)}</tr></thead><tbody>{weekdays.map((day, dayIndex) => <tr key={day}><th scope="row">{day}</th>{times.map((time) => { const count = values.get(`${dayIndex}-${time}`) ?? 0; return <td key={time}><span className={styles.heatmapCell} style={cellStyle(count)} title={`${day} ${time}: ${count} recorded attendee${count === 1 ? "" : "s"}`}>{count}</span></td>; })}</tr>)}</tbody></table> : <p className={styles.empty}>No event slots match these filters.</p>}
    </div>
    <p className={styles.analyticsNote}>This shows event patterns, not individual volunteer behaviour. Corporate attendance is included when recorded as completed.</p>
  </section>;
}
