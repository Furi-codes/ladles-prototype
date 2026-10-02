"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getEventSlotStartAt } from "@/lib/attendance-utils";
import { hasEventFinished } from "@/lib/date-utils";
import type { Event } from "@/lib/types";
import styles from "../volunteer.module.css";
import ActiveShifts from "./ActiveShifts";
import ConfirmDialog from "./ConfirmDialog";
import ConsentPrompt from "./ConsentPrompt";
import DateOfBirthPrompt from "./DateOfBirthPrompt";
import EventModal from "./EventModal";
import NotificationPanel from "./NotificationPanel";
import UpcomingEvents from "./UpcomingEvents";
import PersonalStats from "./PersonalStats";
import ui from "./experience.module.css";
import { useVolunteerData } from "./VolunteerProvider";

export default function VolunteerDashboard() {
  const router = useRouter();
  const {
    user, profile, events, eventSlots, bookings, attendanceRecords, isLoading, loadError, refreshData,
    createUserBooking, cancelBooking, saveProfile, acceptConsent, consent,
  } = useVolunteerData();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
  const getEventData = (eventId: number) => events.find((event) => event.id === eventId);
  const isUserBookedForEvent = (eventId: number) => bookings.some((booking) => booking.event_id === eventId && booking.user_id === user?.id);
  const activeBookings = bookings.filter((booking) => {
    const event = getEventData(booking.event_id);
    return booking.user_id === user?.id
      && (booking.status === "Confirmed" || booking.status === "Present")
      && event?.status !== "Cancelled"
      && event !== undefined
      && !hasEventFinished(event, eventSlots);
  });
  const sortedBookings = [...activeBookings].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Present' ? -1 : 1;
    const start = (booking: typeof a) => {
      const event = getEventData(booking.event_id);
      const slot = eventSlots.find(s => s.id === booking.event_slot_id);
      return event && slot ? getEventSlotStartAt(event, slot) : event?.date ?? '';
    };
    return start(a).localeCompare(start(b));
  });

  if (loadError) return <section className={styles.card}><div className={ui.body}><h1 className={styles.pageTitle}>Your volunteering</h1><p role="alert">{loadError}</p><button className={styles.primaryButton} onClick={() => void refreshData()}>Try again</button></div></section>;

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>Welcome back, {profile?.full_name?.split(' ')[0] || 'volunteer'}</h1><p className={styles.pageDescription}>Your time makes a difference. Find your next opportunity and manage your shifts.</p></div>
      <div className={styles.toolbar}><button type="button" className={styles.secondaryButton} onClick={() => router.push("/volunteer/attendance")}>Attendance scanner</button><span className={styles.liveStatus}><span className={styles.liveDot} aria-hidden="true" />Live updates</span></div>
    </section>
    <NotificationPanel compact />
    <PersonalStats bookings={bookings} attendance={attendanceRecords} userId={user?.id} activeCount={activeBookings.length} loading={isLoading} />
    <div className={styles.dashboardGrid}>
      <UpcomingEvents events={events} eventSlots={eventSlots} isLoading={isLoading} isUserBookedForEvent={isUserBookedForEvent} onSelect={setSelectedEvent} />
      <div className={styles.rightColumn}>
        <ActiveShifts userBookings={sortedBookings} attendanceRecords={attendanceRecords} eventSlots={eventSlots} isLoading={isLoading} getEventData={getEventData} onCancelRequest={setBookingToCancel} onView={setSelectedEvent} />
      </div>
    </div>
    <EventModal key={selectedEvent?.id ?? "no-event"} event={events.find(event => event.id === selectedEvent?.id) ?? null} eventSlots={eventSlots.filter((slot) => slot.event_id === selectedEvent?.id)} bookings={bookings} profile={profile} onClose={() => setSelectedEvent(null)} onBook={createUserBooking} />
    {!profile?.date_of_birth && <DateOfBirthPrompt onSave={(dateOfBirth) => saveProfile({ full_name: profile?.full_name ?? "Volunteer", date_of_birth: dateOfBirth })} />}
    {profile?.date_of_birth && !consent && <ConsentPrompt onAccept={acceptConsent} />}
    {bookingToCancel !== null && <ConfirmDialog title="Cancel booking?" message="Are you sure you want to cancel this booking? This action cannot be undone." confirmLabel="Cancel booking" onCancel={() => setBookingToCancel(null)} onConfirm={() => { void cancelBooking(bookingToCancel); setBookingToCancel(null); }} />}
  </>;
}
