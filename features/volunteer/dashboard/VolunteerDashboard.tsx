"use client";
/**
 * Brings together the volunteer's shifts, available events and contribution summary.
 * Related rows are read from the shared provider, and booking actions go back through that
 * provider.
 */

import { useState } from "react";
import { getEventSlotStartAt } from "@/lib/dates/attendance";
import { hasEventFinished } from "@/lib/dates/calendar";
import type { Event } from "@/lib/types";
import styles from "@/styles/volunteer.module.css";
import ActiveShifts from "@/features/volunteer/bookings/ActiveShifts";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ConsentPrompt from "@/features/volunteer/profile/ConsentPrompt";
import DateOfBirthPrompt from "@/features/volunteer/profile/DateOfBirthPrompt";
import EventModal from "@/features/volunteer/events/EventModal";
import NotificationPanel from "@/features/volunteer/notifications/NotificationPanel";
import UpcomingEvents from "@/features/volunteer/events/UpcomingEvents";
import PersonalStats from "@/features/volunteer/dashboard/PersonalStats";
import ui from "@/styles/experience.module.css";
import { useVolunteerData } from "@/features/volunteer/shell/VolunteerProvider";
import ImpactHero from '@/components/experience/ImpactHero';

export default function VolunteerDashboard() {
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
    <ImpactHero variant="volunteer" eyebrow="YOUR VOLUNTEERING" title={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'volunteer'}.`} accent="A little time. A lasting difference." description="Find your next event, manage your shifts and see your contribution." href="/volunteer/attendance" action="Open attendance scanner"><span className={styles.liveStatus}><span className={styles.liveDot} aria-hidden="true" />Live updates</span></ImpactHero>
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
