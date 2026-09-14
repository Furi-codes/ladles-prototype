"use client";

import { useState } from "react";
import { getLocalDateString } from "@/lib/date-utils";
import type { Event } from "@/lib/types";
import styles from "../volunteer.module.css";
import ActiveShifts from "./ActiveShifts";
import ConfirmDialog from "./ConfirmDialog";
import DateOfBirthPrompt from "./DateOfBirthPrompt";
import EventModal from "./EventModal";
import NotificationPanel from "./NotificationPanel";
import ProgressionPanel from "./ProgressionPanel";
import UpcomingEvents from "./UpcomingEvents";
import WelcomeCard from "./WelcomeCard";
import { useVolunteerData } from "./VolunteerProvider";

export default function VolunteerDashboard() {
  const {
    user, profile, events, eventSlots, bookings, notifications, isLoading,
    createUserBooking, cancelBooking, dismissNotification, updateDateOfBirth,
  } = useVolunteerData();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
  const getEventData = (eventId: number) => events.find((event) => event.id === eventId);
  const isUserBookedForEvent = (eventId: number) => bookings.some((booking) => booking.event_id === eventId && booking.user_id === user?.id);
  const activeBookings = bookings.filter((booking) => booking.user_id === user?.id && booking.status === "Confirmed" && getEventData(booking.event_id)?.status !== "Cancelled");
  const activeEventCount = events.filter((event) => event.status !== "Cancelled" && event.date >= getLocalDateString()).length;

  return <>
    <section className={styles.pageHeading}>
      <div><h1 className={styles.pageTitle}>Volunteer dashboard</h1><p className={styles.pageDescription}>Find events, manage your shifts, and track your participation.</p></div>
      <div className={styles.toolbar}><span className={styles.liveStatus}><span className={styles.liveDot} aria-hidden="true" />Live updates</span></div>
    </section>
    <NotificationPanel notifications={notifications} onDismiss={(notificationId) => void dismissNotification(notificationId)} />
    <WelcomeCard profile={profile} activeShifts={activeBookings.length} eventsCount={activeEventCount} />
    <div className={styles.dashboardGrid}>
      <UpcomingEvents events={events} eventSlots={eventSlots} isLoading={isLoading} isUserBookedForEvent={isUserBookedForEvent} onSelect={setSelectedEvent} />
      <div className={styles.rightColumn}>
        <ActiveShifts userBookings={activeBookings} isLoading={isLoading} getEventData={getEventData} onCancelRequest={setBookingToCancel} />
        <ProgressionPanel bookings={bookings} userId={user?.id} />
      </div>
    </div>
    <EventModal key={selectedEvent?.id ?? "no-event"} event={selectedEvent} eventSlots={eventSlots.filter((slot) => slot.event_id === selectedEvent?.id)} bookings={bookings} profile={profile} onClose={() => setSelectedEvent(null)} onBook={createUserBooking} />
    {!profile?.date_of_birth && <DateOfBirthPrompt onSave={updateDateOfBirth} />}
    {bookingToCancel !== null && <ConfirmDialog title="Cancel booking?" message="Are you sure you want to cancel this booking? This action cannot be undone." confirmLabel="Cancel booking" onCancel={() => setBookingToCancel(null)} onConfirm={() => { void cancelBooking(bookingToCancel); setBookingToCancel(null); }} />}
  </>;
}
