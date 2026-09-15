import LiveAttendanceTime from "@/app/components/LiveAttendanceTime";
import LiveShiftSchedule from "@/app/components/LiveShiftSchedule";
import { getEventSlotEndAt, getEventSlotStartAt } from "@/lib/attendance-utils";
import type { AttendanceRecord, Booking, Event, EventSlot } from "@/lib/types";
import styles from "../volunteer.module.css";

type ActiveShiftsProps = {
  userBookings: Booking[];
  getEventData: (id: number) => Event | undefined;
  onCancelRequest: (id: number) => void;
  isLoading: boolean;
  attendanceRecords: AttendanceRecord[];
  eventSlots: EventSlot[];
};

export default function ActiveShifts({
  userBookings,
  getEventData,
  onCancelRequest,
  isLoading,
  attendanceRecords,
  eventSlots,
}: ActiveShiftsProps) {
  return <section className={styles.card}>
    <div className={styles.cardHeader}>
      <div><h2 className={styles.cardTitle}>My active shifts</h2><p className={styles.cardHint}>Your confirmed bookings and any shift currently in progress.</p></div>
      <span className={styles.eventCount}>{userBookings.length}</span>
    </div>
    {isLoading ? <div className={styles.emptySmall}>Loading your shifts...</div> : userBookings.length === 0 ? <div className={styles.empty}>You have no active shifts yet.<br />Select an upcoming event to sign up.</div> : <div className={styles.shiftList}>
      {userBookings.map((booking) => {
        const event = getEventData(booking.event_id);
        const attendance = attendanceRecords.find((record) => record.booking_id === booking.id);
        const slot = eventSlots.find((item) => item.id === booking.event_slot_id);
        const startsAt = event && slot ? getEventSlotStartAt(event, slot) : undefined;
        const endsAt = event && slot ? getEventSlotEndAt(event, slot) : undefined;
        const clockedIn = Boolean(attendance?.clocked_in_at && !attendance?.clocked_out_at);

        return <div className={styles.shiftRow} key={booking.id}>
          <div>
            <div className={styles.shiftName}>{event?.title ?? "Unknown event"}</div>
            <div className={styles.shiftMeta}>{event?.date ?? "Date unavailable"} · {event?.location ?? "Location unavailable"}</div>
            <span className={styles.shiftTime}>{booking.selected_slot}</span>
            {startsAt && endsAt && <div className={styles.shiftSchedule}><LiveShiftSchedule startsAt={startsAt} endsAt={endsAt} /></div>}
            {clockedIn && attendance && <div className={styles.liveShift}><span className={styles.liveDot} aria-hidden="true" /><LiveAttendanceTime attendance={attendance} endsAt={endsAt} /></div>}
          </div>
          {clockedIn ? <span className={styles.clockedInStatus}>Shift in progress</span> : <button type="button" className={styles.dangerButton} onClick={() => onCancelRequest(booking.id)}>Cancel</button>}
        </div>;
      })}
    </div>}
  </section>;
}
