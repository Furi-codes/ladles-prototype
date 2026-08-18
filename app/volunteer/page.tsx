"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import moment from "moment";
import { supabase, getCurrentUser, getCurrentUserProfile } from "@/lib/supabase";

// ============================================
// TYPES
// ============================================
interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  time_slots: string;
  total_slots: number;
  description?: string;
}

interface Booking {
  id: number;
  event_id: number;
  volunteer_name: string;
  volunteer_email: string;
  selected_slot: string;
  status: string;
  user_id?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

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
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
          
          // Get user profile
          const userProfile = await getCurrentUserProfile();
          if (userProfile) {
            setProfile(userProfile);
          } else {
            // If no profile exists, create one from user data
            const { data: newProfile, error } = await supabase
              .from('profiles')
              .insert([{
                id: currentUser.id,
                full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Volunteer',
                email: currentUser.email
              }])
              .select()
              .single();
              
            if (!error && newProfile) {
              setProfile(newProfile);
            }
          }
        } else {
          setIsAuthenticated(false);
          // Redirect to login if not authenticated
          // router.push('/login');
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingUser(false);
      }
    }
    
    loadUser();
  }, []);

  // ============================================
  // FETCH DATA
  // ============================================
  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: eData } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });
      if (eData) setEvents(eData);

      const { data: bData } = await supabase
        .from("bookings")
        .select("*")
        .order("id", { ascending: false });
      if (bData) setBookings(bData);
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
    );
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
      const { error } = await supabase.from("bookings").insert([{
        event_id: selectedEvent!.id,
        user_id: user.id,
        volunteer_name: profile?.full_name || user.email?.split('@')[0] || 'Volunteer',
        volunteer_email: user.email,
        selected_slot: selectedTimeSlot,
        status: "Confirmed"
      }]);

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
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId)
        .eq("user_id", user?.id); // Only allow user to cancel their own bookings

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
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f3f3f3",
      color: "#2b3336",
      fontFamily: "'Helvetica Neue', Arial, sans-serif"
    }}>

      {/* TOAST CONTAINER */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* RED TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "6px",
        background: "#ef3a40", zIndex: 100
      }} />

      {/* HEADER */}
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 32px",
        height: "70px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        marginTop: "6px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden" }}>
            <Image
              src="/ladles-logo.png"
              alt="Ladles of Love"
              width={44}
              height={44}
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
            />
          </div>
          <div>
            <h1 style={{ color: "#2b3336", margin: 0, fontSize: "17px", fontWeight: "800", letterSpacing: "-0.3px" }}>
              LADLES OF LOVE
            </h1>
            <div style={{ fontSize: "11px", color: "#ef3a40", letterSpacing: "1px", textTransform: "uppercase", fontStyle: "italic" }}>
              feeding the soul
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {/* User Info */}
          {isAuthenticated && profile && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              background: "#f3f3f3",
              borderRadius: "20px",
              fontSize: "13px",
              color: "#2b3336"
            }}>
              <span>👋</span>
              <span style={{ fontWeight: "600" }}>{profile.full_name}</span>
            </div>
          )}
          
          <button
            onClick={() => router.push("/admin")}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "1.5px solid #2b3336",
              background: "#fff",
              color: "#2b3336",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              letterSpacing: "0.5px",
              transition: "all 0.2s",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#2b3336";
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              (e.currentTarget as HTMLButtonElement).style.color = "#2b3336";
            }}
          >
            ← Admin Dashboard
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ padding: "40px 32px", maxWidth: "1400px", margin: "0 auto" }}>

        {/* LIVE STATUS INDICATOR */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#16a34a",
            padding: "6px 14px",
            background: "#dcfce7",
            borderRadius: "20px"
          }}>
            <span style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#16a34a",
              animation: "pulse 1.5s infinite"
            }}></span>
            Live Updates
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {isAuthenticated && (
              <span style={{
                fontSize: "13px",
                color: "#2b3336",
                fontWeight: "600"
              }}>
                ✅ Logged in as {profile?.full_name || user?.email}
              </span>
            )}
            <button
              onClick={fetchData}
              style={{
                padding: "6px 16px",
                background: "#2b3336",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* WELCOME SECTION - No name input required anymore */}
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px 24px",
          marginBottom: "32px",
          border: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div>
            {isLoadingUser ? (
              <span style={{ fontSize: "14px", color: "#666" }}>Loading your profile...</span>
            ) : isAuthenticated ? (
              <span style={{ fontSize: "14px", color: "#2b3336" }}>
                👋 Welcome back, <strong>{profile?.full_name || user?.email}</strong>! 
                You have <strong style={{ color: "#ef3a40" }}>{userBookings.length}</strong> active shift{userBookings.length !== 1 ? 's' : ''}.
              </span>
            ) : (
              <span style={{ fontSize: "14px", color: "#ef3a40" }}>
                ⚠️ Please log in to sign up for events.
              </span>
            )}
          </div>
          <div style={{
            fontSize: "12px",
            color: "#666",
            background: "#f3f3f3",
            padding: "4px 12px",
            borderRadius: "12px"
          }}>
            📅 {events.length} events available
          </div>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
          alignItems: "start"
        }}>

          {/* LEFT COLUMN - CALENDAR */}
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            padding: "24px",
            overflow: "hidden"
          }}>
            <h2 style={{ fontSize: "20px", color: "#2b3336", margin: "0 0 20px", fontWeight: "800" }}>
              📅 Event Calendar
            </h2>
            <p style={{ color: "#666", fontSize: "13px", margin: "0 0 20px", lineHeight: "1.5" }}>
              Click on any highlighted date to see available events and sign up.
            </p>

            {isLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Loading calendar...</div>
            ) : (
              <div className="calendar-wrapper">
                <Calendar
                  onChange={() => {}}
                  value={new Date()}
                  tileClassName={tileClassName}
                  tileContent={tileContent}
                  minDate={new Date()}
                  locale="en-US"
                  onClickDay={(date) => {
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
              </div>
            )}

            {/* LEGEND */}
            <div style={{
              marginTop: "20px",
              padding: "12px 16px",
              background: "#f8f8f8",
              borderRadius: "6px",
              display: "flex",
              gap: "24px",
              flexWrap: "wrap"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                <span style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#ef3a40"
                }}></span>
                Events available
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                <span style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#2b3336"
                }}></span>
                You're signed up
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - ACTIVE SHIFTS */}
          <div>
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              overflow: "hidden",
              marginBottom: "32px"
            }}>
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h3 style={{ fontSize: "18px", color: "#2b3336", margin: 0, fontWeight: "800" }}>
                  My Active Shifts
                </h3>
                <span style={{
                  fontSize: "12px",
                  color: "#fff",
                  fontWeight: "700",
                  background: "#ef3a40",
                  padding: "4px 12px",
                  borderRadius: "20px"
                }}>
                  {userBookings.length}
                </span>
              </div>

              {!isAuthenticated ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#999", fontSize: "14px" }}>
                  🔒 Please log in to see your shifts
                </div>
              ) : isLoading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#666", fontSize: "14px" }}>
                  Loading your shifts...
                </div>
              ) : userBookings.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#999", fontSize: "14px" }}>
                  You have no active shifts.<br />
                  <span style={{ fontSize: "12px", color: "#ccc" }}>
                    Click on an event in the calendar to sign up!
                  </span>
                </div>
              ) : (
                <div style={{ padding: "8px 0" }}>
                  {userBookings.map((booking) => {
                    const eventInfo = getEventData(booking.event_id);
                    return (
                      <div
                        key={booking.id}
                        style={{
                          padding: "16px 24px",
                          borderBottom: "1px solid #f3f3f3",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "#2b3336", marginBottom: "4px" }}>
                            {eventInfo?.title || "Unknown Event"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                            📍 {eventInfo?.location || "N/A"} &nbsp;|&nbsp; 📅 {eventInfo?.date || "N/A"}
                          </div>
                          <div style={{
                            fontSize: "11px",
                            color: "#2b3336",
                            background: "#f3f3f3",
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontWeight: "600"
                          }}>
                            ⏱️ {booking.selected_slot}
                          </div>
                        </div>
                        <button
                          onClick={() => cancelBooking(booking.id)}
                          style={{
                            padding: "6px 14px",
                            background: "#ef3a40",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "background 0.2s"
                          }}
                          onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#cc2222"}
                          onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#ef3a40"}
                        >
                          Cancel Shift
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MY PROGRESSION */}
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              overflow: "hidden"
            }}>
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h3 style={{
                  fontSize: "18px",
                  color: "#2b3336",
                  margin: 0,
                  fontWeight: "800"
                }}>
                  My Progression
                </h3>
              </div>

              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr style={{ background: "#f3f3f3" }}>
                    <th style={{
                      padding: "12px 24px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#2b3336",
                      textTransform: "uppercase",
                      letterSpacing: "1px"
                    }}>
                      Progress
                    </th>
                    <th style={{
                      padding: "12px 24px",
                      textAlign: "right",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#2b3336",
                      textTransform: "uppercase",
                      letterSpacing: "1px"
                    }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{
                    borderBottom: "1px solid #f3f3f3"
                  }}>
                    <td style={{
                      padding: "16px 24px",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}>
                      Hours Volunteered
                    </td>
                    <td style={{
                      padding: "16px 24px",
                      textAlign: "right",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#ef3a40"
                    }}>
                      {bookings
                        .filter(b => b.status === "Completed" && b.user_id === user?.id)
                        .reduce((total) => total + 2, 0)} hours
                    </td>
                  </tr>
                  <tr>
                    <td style={{
                      padding: "16px 24px",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}>
                      Events Completed
                    </td>
                    <td style={{
                      padding: "16px 24px",
                      textAlign: "right",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#ef3a40"
                    }}>
                      {bookings.filter(b => b.status === "Completed" && b.user_id === user?.id).length}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{
                padding: "12px 24px",
                borderTop: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <button
                  onClick={() => printMyProgression()}
                  style={{
                    padding: "8px 18px",
                    background: "#fff",
                    color: "#2b3336",
                    border: "1px solid #2b3336",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#2b3336";
                    (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                    (e.currentTarget as HTMLButtonElement).style.color = "#2b3336";
                  }}
                >
                  🖨️ Print My Progression
                </button>

                <span style={{
                  fontSize: "11px",
                  color: "#999"
                }}>
                  {bookings.filter(b => b.status === "Completed" && b.user_id === user?.id).length} events completed
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* EVENT LIST MODAL (Multiple Events on a Date) */}
        {showEventListModal && eventsOnDate.length > 0 && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)"
          }}>
            <div style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "550px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              animation: "slideUp 0.3s ease-out"
            }}>
              <button
                onClick={() => {
                  setShowEventListModal(false);
                  setEventsOnDate([]);
                }}
                style={{
                  float: "right",
                  background: "none",
                  border: "none",
                  fontSize: "28px",
                  color: "#999",
                  cursor: "pointer",
                  padding: "0 4px"
                }}
              >
                ×
              </button>

              <h2 style={{ 
                fontSize: "22px", 
                color: "#2b3336", 
                margin: "0 0 8px", 
                fontWeight: "800" 
              }}>
                📅 Events on {moment(eventsOnDate[0]?.date).format("MMMM D, YYYY")}
              </h2>
              <p style={{ 
                fontSize: "13px", 
                color: "#666", 
                marginBottom: "20px" 
              }}>
                {eventsOnDate.length} events available. Click one to sign up.
              </p>

              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                {eventsOnDate.map((event) => {
                  const isBooked = isUserBookedForEvent(event.id);
                  return (
                    <div
                      key={event.id}
                      style={{
                        padding: "16px 20px",
                        borderRadius: "10px",
                        border: "1.5px solid #e0e0e0",
                        background: "#fafafa",
                        cursor: isBooked ? "default" : "pointer",
                        transition: "all 0.2s",
                        opacity: isBooked ? 0.6 : 1,
                      }}
                      onClick={() => {
                        if (!isBooked && isAuthenticated) {
                          setShowEventListModal(false);
                          handleEventClick(event);
                        } else if (!isAuthenticated) {
                          showToast("error", "Please log in first!");
                        }
                      }}
                      onMouseOver={e => {
                        if (!isBooked && isAuthenticated) {
                          (e.currentTarget as HTMLDivElement).style.background = "#f3f3f3";
                          (e.currentTarget as HTMLDivElement).style.borderColor = "#ef3a40";
                        }
                      }}
                      onMouseOut={e => {
                        if (!isBooked && isAuthenticated) {
                          (e.currentTarget as HTMLDivElement).style.background = "#fafafa";
                          (e.currentTarget as HTMLDivElement).style.borderColor = "#e0e0e0";
                        }
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px"
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: "16px",
                            fontWeight: "700",
                            color: isBooked ? "#999" : "#2b3336",
                            marginBottom: "4px"
                          }}>
                            {event.title}
                            {isBooked && (
                              <span style={{
                                fontSize: "11px",
                                color: "#16a34a",
                                background: "#dcfce7",
                                padding: "2px 10px",
                                borderRadius: "12px",
                                marginLeft: "10px",
                                fontWeight: "600"
                              }}>
                                ✅ Signed up
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: "13px",
                            color: "#666",
                            marginBottom: "4px"
                          }}>
                            📍 {event.location}
                          </div>
                          <div style={{
                            fontSize: "12px",
                            color: "#888"
                          }}>
                            ⏱️ {event.time_slots} · 👥 {event.total_slots} spots
                          </div>
                        </div>
                        {!isBooked && isAuthenticated && (
                          <div style={{
                            padding: "6px 14px",
                            background: "#ef3a40",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "700",
                            whiteSpace: "nowrap"
                          }}>
                            Sign Up →
                          </div>
                        )}
                        {!isAuthenticated && (
                          <div style={{
                            padding: "6px 14px",
                            background: "#999",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "700",
                            whiteSpace: "nowrap"
                          }}>
                            🔒 Login
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                marginTop: "20px",
                padding: "12px 16px",
                background: "#f8f8f8",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#666",
                textAlign: "center"
              }}>
                💡 Click any event above to sign up for a time slot
              </div>
            </div>
          </div>
        )}

      </main>

      {/* EVENT DETAIL MODAL */}
      {showEventModal && selectedEvent && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            animation: "slideUp 0.3s ease-out"
          }}>
            <button
              onClick={() => {
                setShowEventModal(false);
                setSelectedEvent(null);
                setBookingMessage(null);
              }}
              style={{
                float: "right",
                background: "none",
                border: "none",
                fontSize: "28px",
                color: "#999",
                cursor: "pointer",
                padding: "0 4px"
              }}
            >
              ×
            </button>

            <h2 style={{ fontSize: "24px", color: "#2b3336", margin: "0 0 8px", fontWeight: "800" }}>
              {selectedEvent.title}
            </h2>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "6px" }}>
                📅 {selectedEvent.date}
              </div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "6px" }}>
                📍 {selectedEvent.location}
              </div>
              <div style={{ fontSize: "14px", color: "#666", marginBottom: "6px" }}>
                👥 Capacity: {selectedEvent.total_slots} volunteers
              </div>
              {selectedEvent.description && (
                <div style={{ fontSize: "14px", color: "#555", marginTop: "12px", lineHeight: "1.6" }}>
                  {selectedEvent.description}
                </div>
              )}
            </div>

            {/* Sign Up Form */}
            {!isUserBookedForEvent(selectedEvent.id) ? (
              <form onSubmit={handleSignUp}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "11px", color: "#2b3336", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                    Select Time Slot
                  </label>
                  <select
                    required
                    value={selectedTimeSlot}
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: "1.5px solid #ddd",
                      fontSize: "14px",
                      background: "#f8f8f8",
                      color: "#2b3336",
                      outline: "none"
                    }}
                  >
                    <option value="" disabled>Choose a time slot</option>
                    {selectedEvent.time_slots.split(",").map((slot: string, i: number) => {
                      const isBooked = bookings.some(b =>
                        b.event_id === selectedEvent.id &&
                        b.selected_slot === slot.trim()
                      );
                      return (
                        <option
                          key={i}
                          value={slot.trim()}
                          disabled={isBooked}
                          style={{ color: isBooked ? "#999" : "#2b3336" }}
                        >
                          {slot.trim()} {isBooked ? "🔴 (Taken)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Show user info being used */}
                <div style={{
                  padding: "10px 14px",
                  background: "#f8f8f8",
                  borderRadius: "6px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  color: "#666"
                }}>
                  👤 Signing up as: <strong>{profile?.full_name || user?.email}</strong>
                </div>

                {bookingMessage && (
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    marginBottom: "16px",
                    background: bookingMessage.type === 'success' ? "#dcfce7" : "#fee2e2",
                    color: bookingMessage.type === 'success' ? "#166534" : "#991b1b",
                    fontSize: "13px"
                  }}>
                    {bookingMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "8px",
                    background: isSubmitting ? "#999" : "#ef3a40",
                    color: "white",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    boxShadow: "0 4px 14px rgba(239,58,64,0.35)",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={e => {
                    if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = "#2b3336";
                  }}
                  onMouseOut={e => {
                    if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = "#ef3a40";
                  }}
                >
                  {isSubmitting ? "Signing up..." : "✅ Sign Up for This Event"}
                </button>
              </form>
            ) : (
              <div style={{
                padding: "20px",
                background: "#dcfce7",
                borderRadius: "8px",
                textAlign: "center",
                color: "#166534",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                ✅ You're already signed up for this event!
                <br />
                <span style={{ fontSize: "12px", fontWeight: "400", color: "#555" }}>
                  Your shift: {getBookingForEvent(selectedEvent.id)?.selected_slot}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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