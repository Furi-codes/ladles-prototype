"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import moment from "moment";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getCurrentUserProfile } from "@/lib/supabase";
import {
  cancelUserBooking,
  createBooking,
  ensureUserProfile,
  fetchBookingsForVolunteer,
  fetchEventsForVolunteer,
} from "@/lib/actions/volunteer";
import { fetchUserRole } from "@/lib/actions/profile";
import type { Booking, BookingStatus, Event, VolunteerProfile } from "@/lib/types";

import LoadingScreen from "./components/LoadingScreen";
import ToastContainer from "./components/ToastContainer";
import VolunteerHeader from "./components/VolunteerHeader";
import EventListModal from "./components/EventListModal";
import EventModal from "./components/EventModal";
import CalendarPanel from "./components/CalendarPanel";
import ActiveShifts from "./components/ActiveShifts";
import ProgressionPanel from "./components/ProgressionPanel";
import LiveStatusBar from "./components/LiveStatusBar";
import WelcomeCard from "./components/WelcomeCard";

interface Profile extends VolunteerProfile {}

// ============================================
// MAIN COMPONENT
// ============================================
export default function VolunteerCalendar() {
  const router = useRouter();

  // --- STATE ---
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; type: string; message: string }[]>([]);
  
  // --- USER STATE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    router.replace('/');
  }
  
  // --- EVENT LIST MODAL STATE ---
  const [eventsOnDate, setEventsOnDate] = useState<Event[]>([]);
  const [showEventListModal, setShowEventListModal] = useState(false);

  // ============================================
  // AUTH - GET CURRENT USER
  // ============================================
  useEffect(() => {
    async function loadUser() {
      setIsLoadingUser(true);
      try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
          setIsAuthenticated(false);
          router.replace('/');
          return;
        }

        const { data: roleProfile, error: roleError } = await fetchUserRole(currentUser.id);

        if (roleError || !roleProfile) {
          setIsAuthenticated(false);
          router.replace('/');
          return;
        }

        if (roleProfile.role === 'admin') {
          router.replace('/admin');
          return;
        }

        if (roleProfile.role !== 'volunteer') {
          router.replace('/');
          return;
        }

        setUser(currentUser);
        setIsAuthenticated(true);

        const userProfile = await getCurrentUserProfile();
        if (userProfile) {
          setProfile(userProfile);
        } else {
          const { data: newProfile, error } = await ensureUserProfile(
            currentUser.id,
            currentUser.email,
            currentUser.user_metadata?.full_name
          );

          if (!error && newProfile) {
            setProfile(newProfile as Profile);
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setIsAuthenticated(false);
        router.replace('/');
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, [router]);

  // ============================================
  // FETCH DATA
  // ============================================
  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: eData } = await fetchEventsForVolunteer();
      if (eData) setEvents(eData as Event[]);

      const { data: bData } = await fetchBookingsForVolunteer();
      if (bData) setBookings(bData as Booking[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("error", "Failed to load data. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  }

  // ============================================
  // REAL-TIME SUBSCRIPTION
  // ============================================
  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('volunteer-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('🔄 Booking changed:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================
  function showToast(type: 'success' | 'error' | 'info', message: string) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }

  // ============================================
  // HELPERS
  // ============================================
  function getEventsForDate(date: Date) {
    const dateString = moment(date).format("YYYY-MM-DD");
    return events.filter(event => event.date === dateString);
  }

  function hasEvents(date: Date) {
    return getEventsForDate(date).length > 0;
  }

  function isUserBookedForEvent(eventId: number) {
    if (!user) return false;
    return bookings.some(booking =>
      booking.event_id === eventId &&
      booking.user_id === user.id
    );
  }

  function getBookingForEvent(eventId: number) {
    if (!user) return null;
    return bookings.find(booking =>
      booking.event_id === eventId &&
      booking.user_id === user.id
      ) ?? null;
  }

  function getEventData(eventId: number) {
    return events.find(e => e.id === eventId);
  }

  // ============================================
  // GET USER'S BOOKINGS
  // ============================================
  const userBookings = bookings.filter(booking =>
    booking.user_id === user?.id &&
    booking.status === "Confirmed"
  );

  // ============================================
  // HANDLE EVENT CLICK
  // ============================================
  function handleEventClick(event: Event) {
    if (!isAuthenticated) {
      showToast("error", "Please log in first!");
      return;
    }
    setSelectedEvent(event);
    setSelectedTimeSlot("");
    setShowEventModal(true);
  }

  // ============================================
  // HANDLE SIGN UP
  // ============================================
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      setBookingMessage({ type: 'error', text: 'Please log in to sign up.' });
      return;
    }

    if (!selectedTimeSlot) {
      setBookingMessage({ type: 'error', text: 'Please select a time slot' });
      return;
    }

    // Check if slot is already taken
    const slotTaken = bookings.some(booking =>
      booking.event_id === selectedEvent?.id &&
      booking.selected_slot === selectedTimeSlot
    );

    if (slotTaken) {
      setBookingMessage({ type: 'error', text: 'This time slot is already taken. Please choose another.' });
      return;
    }

    // Check if user already has a booking for this event
    if (isUserBookedForEvent(selectedEvent!.id)) {
      setBookingMessage({ type: 'error', text: 'You are already signed up for this event!' });
      return;
    }

    setIsSubmitting(true);
    setBookingMessage(null);

    try {
      const { error } = await createBooking({
        event_id: selectedEvent!.id,
        user_id: user.id,
        volunteer_name: profile?.full_name || user.email?.split('@')[0] || 'Volunteer',
        volunteer_email: user.email ?? null,
        selected_slot: selectedTimeSlot,
        status: "Confirmed" as BookingStatus,
      });

      if (error) throw error;

      showToast("success", `✅ Successfully signed up for ${selectedEvent!.title}!`);
      setBookingMessage({ type: 'success', text: '✅ Successfully signed up for the event!' });

      setTimeout(() => {
        setShowEventModal(false);
        setSelectedEvent(null);
        setSelectedTimeSlot("");
        setBookingMessage(null);
      }, 2000);

    } catch (error) {
      console.error("Booking error:", error);
      setBookingMessage({ type: 'error', text: 'Failed to sign up. Please try again.' });
      showToast("error", "Failed to sign up. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ============================================
  // HANDLE CANCEL BOOKING
  // ============================================
  async function cancelBooking(bookingId: number) {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    try {
      const { error } = await cancelUserBooking(bookingId, user?.id ?? '');

      if (error) throw error;
      showToast("info", "Booking cancelled successfully");
    } catch (error) {
      console.error("Cancel error:", error);
      showToast("error", "Failed to cancel booking. Please try again.");
    }
  }

  // ============================================
  // PRINT MY PROGRESSION
  // ============================================
  function printMyProgression() {
    const completedBookings = bookings.filter(b => 
      b.status === "Completed" && 
      b.user_id === user?.id
    );
    
    if (completedBookings.length === 0) {
      showToast("info", "You haven't completed any events yet!");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rows = completedBookings.map((booking) => {
      const eventInfo = getEventData(booking.event_id);
      return `
        <tr>
          <td>${eventInfo?.title || "Unknown Event"}</td>
          <td>
            ${eventInfo?.date || "N/A"}<br>
            ${eventInfo?.location || "N/A"}
          </td>
          <td>${booking.selected_slot || "N/A"}</td>
          <td>${booking.status || "N/A"}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Ladles of Love - Volunteer Progression</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #2b3336; }
            h1 { margin-bottom: 5px; color: #2b3336; }
            .subtitle { color: #666; font-size: 14px; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { background: #f3f3f3; text-align: left; padding: 12px; border: 1px solid #ddd; font-weight: 700; }
            td { padding: 12px; border: 1px solid #ddd; }
            .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>🏠 Ladles of Love</h1>
          <p class="subtitle">Volunteer Progression Report</p>
          <p><strong>Volunteer:</strong> ${profile?.full_name || user?.email}</p>
          <p><strong>Total Events Completed:</strong> ${completedBookings.length}</p>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date & Location</th>
                <th>Time Slot</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="footer">
            © 2025 Ladles of Love · Nourishing communities, one ladle at a time.<br>
            Printed on ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  }

  // ============================================
  // CALENDAR RENDER HELPERS
  // ============================================
  function tileClassName({ date }: { date: Date }) {
    if (hasEvents(date)) {
      return "has-event";
    }
    return null;
  }

  function tileContent({ date }: { date: Date }) {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      return (
        <div className="event-dot-container">
          <div className="event-dot"></div>
          <div className="event-count">{dayEvents.length}</div>
        </div>
      );
    }
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  if (isLoadingUser || !isAuthenticated) {
    return <LoadingScreen message="Checking access" />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f3f3f3",
      color: "#2b3336",
      fontFamily: "'Helvetica Neue', Arial, sans-serif"
    }}>

      {/* TOAST CONTAINER */}
      <ToastContainer toasts={toasts} />

      {/* RED TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "6px",
        background: "#ef3a40", zIndex: 100
      }} />

      <VolunteerHeader profile={profile} user={user} isAuthenticated={isAuthenticated} onSignOut={handleSignOut} fetchData={fetchData} />

      {/* MAIN CONTENT */}
      <main style={{ padding: "40px 32px", maxWidth: "1400px", margin: "0 auto" }}>

        <LiveStatusBar isAuthenticated={isAuthenticated} profile={profile} user={user} fetchData={fetchData} />

        <WelcomeCard isLoadingUser={isLoadingUser} isAuthenticated={isAuthenticated} profile={profile} userBookingsCount={userBookings.length} eventsCount={events.length} />

        {/* TWO COLUMN LAYOUT */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
          alignItems: "start"
        }}>

          <CalendarPanel
            isLoading={isLoading}
            tileClassName={tileClassName}
            tileContent={tileContent}
            onDayClick={(date: Date) => {
              console.log("📅 Date clicked:", date);
              const dayEvents = getEventsForDate(date);
              console.log("📋 Events on this date:", dayEvents);
              if (dayEvents.length === 0) {
                showToast("info", "No events on this date. Check other dates!");
                return;
              }
              if (dayEvents.length === 1) {
                handleEventClick(dayEvents[0]);
              } else {
                setEventsOnDate(dayEvents);
                setShowEventListModal(true);
              }
            }}
          />

          {/* RIGHT COLUMN - ACTIVE SHIFTS */}
          <div>
            <ActiveShifts
              userBookings={userBookings}
              isAuthenticated={isAuthenticated}
              isLoading={isLoading}
              cancelBooking={cancelBooking}
              getEventData={getEventData}
            />

            {/* MY PROGRESSION */}
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              overflow: "hidden"
            }}>
              <ProgressionPanel bookings={bookings} user={user} getEventData={getEventData} printMyProgression={printMyProgression} />
            </div>
          </div>

        </div>

        <EventListModal
          events={eventsOnDate}
          onClose={() => { setShowEventListModal(false); setEventsOnDate([]); }}
          onEventClick={(event) => {
            if (!isUserBookedForEvent(event.id) && isAuthenticated) {
              setShowEventListModal(false);
              handleEventClick(event);
            } else if (!isAuthenticated) {
              showToast("error", "Please log in first!");
            }
          }}
          isUserBookedForEvent={isUserBookedForEvent}
          isAuthenticated={isAuthenticated}
        />

      </main>

      <EventModal
        event={selectedEvent}
        bookings={bookings}
        selectedTimeSlot={selectedTimeSlot}
        setSelectedTimeSlot={setSelectedTimeSlot}
        onClose={() => { setShowEventModal(false); setSelectedEvent(null); setBookingMessage(null); }}
        onSubmit={handleSignUp}
        isUserBookedForEvent={isUserBookedForEvent}
        getBookingForEvent={getBookingForEvent}
        isSubmitting={isSubmitting}
        bookingMessage={bookingMessage}
        profile={profile}
        user={user}
      />

      {/* FOOTER */}
      <p style={{
        textAlign: "center",
        fontSize: "12px",
        color: "#2b3336",
        opacity: 0.4,
        paddingBottom: "32px",
        marginTop: "40px"
      }}>
        © 2025 Ladles of Love · Nourishing communities, one ladle at a time.
      </p>
    </div>
  );
}
