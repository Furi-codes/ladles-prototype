"use client";

import { useState } from "react";
import type { Event } from "@/lib/types";
import styles from "../volunteer.module.css";
import CalendarPanel from "./CalendarPanel";
import ActiveShifts from "./ActiveShifts";
import ProgressionPanel from "./ProgressionPanel";
import WelcomeCard from "./WelcomeCard";
import EventListModal from "./EventListModal";
import EventModal from "./EventModal";
import ConfirmDialog from "./ConfirmDialog";
import { useVolunteerData } from "./VolunteerProvider";

export default function VolunteerDashboard() {
  const { user, profile, events, bookings, isLoading, createUserBooking, cancelBooking } = useVolunteerData();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null); const [eventsOnDate, setEventsOnDate] = useState<Event[]>([]); const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
  const getEventsForDate = (date: Date) => events.filter((event) => event.date === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
  const isUserBookedForEvent = (eventId: number) => bookings.some((booking) => booking.event_id === eventId && booking.user_id === user?.id);
  const getEventData = (eventId: number) => events.find((event) => event.id === eventId);
  const activeBookings = bookings.filter((booking) => booking.user_id === user?.id && booking.status === "Confirmed");
  function openDate(date: Date) { const dayEvents = getEventsForDate(date); if (dayEvents.length === 1) setSelectedEvent(dayEvents[0]); else if (dayEvents.length > 1) setEventsOnDate(dayEvents); }
  return <><section className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Volunteer dashboard</h1><p className={styles.pageDescription}>Find events, manage your shifts, and track your participation.</p></div><div className={styles.toolbar}><span className={styles.liveStatus}><span className={styles.liveDot} aria-hidden="true" />Live updates</span></div></section><WelcomeCard profile={profile} activeShifts={activeBookings.length} eventsCount={events.length} /><div className={styles.dashboardGrid}><CalendarPanel isLoading={isLoading} tileClassName={({ date }) => { const dateEvents = getEventsForDate(date); return dateEvents.some((event) => isUserBookedForEvent(event.id)) ? "has-booked-event" : dateEvents.length > 0 ? "has-event" : null; }} onDayClick={openDate} /><div className={styles.rightColumn}><ActiveShifts userBookings={activeBookings} isLoading={isLoading} getEventData={getEventData} onCancelRequest={setBookingToCancel} /><ProgressionPanel bookings={bookings} userId={user?.id} /></div></div><EventListModal events={eventsOnDate} onClose={() => setEventsOnDate([])} onEventClick={(event) => { setEventsOnDate([]); setSelectedEvent(event); }} isUserBookedForEvent={isUserBookedForEvent} /><EventModal key={selectedEvent?.id ?? "no-event"} event={selectedEvent} bookings={bookings} profile={profile} onClose={() => setSelectedEvent(null)} onBook={createUserBooking} />{bookingToCancel !== null && <ConfirmDialog title="Cancel booking?" message="Are you sure you want to cancel this booking? This action cannot be undone." confirmLabel="Cancel booking" onCancel={() => setBookingToCancel(null)} onConfirm={() => { void cancelBooking(bookingToCancel); setBookingToCancel(null); }} />}</>;
}
