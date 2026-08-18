"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import moment from "moment";
import { supabase } from "@/lib/supabase"; // ← Import from lib

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
  selected_slot: string;
  status: string;
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
  const [volunteerName, setVolunteerName] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; type: string; message: string }[]>([]);

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

    // Subscribe to booking changes
    const subscription = supabase
      .channel('volunteer-bookings')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('🔄 Booking changed:', payload);
          fetchData(); // Re-fetch when any change happens
        }
      )
      .subscribe();

    // Cleanup on unmount
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
    return bookings.some(booking =>
      booking.event_id === eventId &&
      booking.volunteer_name.toLowerCase() === volunteerName.toLowerCase()
    );
  }

  function getBookingForEvent(eventId: number) {
    return bookings.find(booking =>
      booking.event_id === eventId &&
      booking.volunteer_name.toLowerCase() === volunteerName.toLowerCase()
    );
  }

  function getEventData(eventId: number) {
    return events.find(e => e.id === eventId);
  }

  // ============================================
  // HANDLE EVENT CLICK
  // ============================================
  function handleEventClick(event: Event) {
    if (!volunteerName.trim()) {
      showToast("error", "Please enter your name first!");
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

    if (!volunteerName.trim()) {
      setBookingMessage({ type: 'error', text: 'Please enter your name' });
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
        volunteer_name: volunteerName.trim(),
        selected_slot: selectedTimeSlot,
        status: "Confirmed"
      }]);

      if (error) throw error;

      showToast("success", `✅ Successfully signed up for ${selectedEvent!.title}!`);
      setBookingMessage({ type: 'success', text: '✅ Successfully signed up for the event!' });

      // Close modal after 2 seconds
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
        .eq("id", bookingId);
      if (error) throw error;
      showToast("info", "Booking cancelled successfully");
    } catch (error) {
      console.error("Cancel error:", error);
      showToast("error", "Failed to cancel booking. Please try again.");
    }
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
  // FILTERED BOOKINGS
  // ============================================
  const userBookings = bookings.filter(booking =>
    booking.volunteer_name.toLowerCase() === volunteerName.toLowerCase() &&
    booking.status === "Confirmed"
  );

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

        {/* NAME INPUT SECTION */}
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "20px 24px",
          marginBottom: "32px",
          border: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <label style={{ fontSize: "11px", color: "#2b3336", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
              Your Name
            </label>
            <input
              placeholder="Enter your name to see your bookings"
              value={volunteerName}
              onChange={(e) => setVolunteerName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "6px",
                border: "1.5px solid #ddd",
                fontSize: "14px",
                boxSizing: "border-box",
                background: "#f8f8f8",
                color: "#2b3336",
                outline: "none"
              }}
            />
          </div>
          <div style={{ fontSize: "13px", color: "#666" }}>
            {volunteerName ? (
              <span>👋 Welcome, <strong>{volunteerName}</strong>! You have <strong>{userBookings.length}</strong> active shift{userBookings.length !== 1 ? 's' : ''}.</span>
            ) : (
              <span>👤 Enter your name to view your shifts</span>
            )}
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
                      // If only one event, open it directly
                      handleEventClick(dayEvents[0]);
                    } else {
                      // If multiple events, show the first one
                      handleEventClick(dayEvents[0]);
                      showToast("info", `📅 ${dayEvents.length} events on this day. Click again to see more.`);
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
              overflow: "hidden"
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

              {!volunteerName ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#999", fontSize: "14px" }}>
                  Enter your name above to see your shifts
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
          </div>

        </div>
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
            {/* Close Button */}
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