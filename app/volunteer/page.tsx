"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";

const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function VolunteerBooking() {
  const router = useRouter();

  const [events, setEvents] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editNewSlot, setEditNewSlot] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setIsLoading(true);
    const { data: eData } = await supabase.from("events").select("*");
    if (eData) setEvents(eData);
    const { data: bData } = await supabase.from("bookings").select("*").order("id", { ascending: false });
    if (bData) setBookings(bData);
    setIsLoading(false);
  }

  async function bookShift(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("bookings").insert([{
      event_id: parseInt(selectedEventId),
      volunteer_name: volunteerName,
      selected_slot: selectedTimeSlot,
      status: "Confirmed"
    }]);
    setVolunteerName(""); setSelectedEventId(""); setSelectedTimeSlot("");
    fetchData();
  }

  async function saveUpdatedSlot(bookingId: number) {
    await supabase.from("bookings").update({ selected_slot: editNewSlot }).eq("id", bookingId);
    setEditingBookingId(null);
    fetchData();
  }

  async function cancelBooking(id: number) {
    await supabase.from("bookings").delete().eq("id", id);
    fetchData();
  }

  function getEventData(eventId: number) {
    return events.find(e => e.id === eventId);
  }

  const currentEventObj = events.find(e => e.id.toString() === selectedEventId);
  const availableSlotsArray = currentEventObj ? currentEventObj.time_slots.split(",") : [];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f3f3", color: "#2b3336", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>

      {/* RED TOP BAR */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "6px", background: "#ef3a40", zIndex: 100 }} />

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
            <Image src="/ladles-logo.png" alt="Ladles of Love" width={44} height={44}
              style={{ objectFit: "contain", width: "100%", height: "100%" }} />
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

        <button
          onClick={() => router.push("/admin")}
          style={{
            padding: "8px 18px", borderRadius: "6px", border: "1.5px solid #2b3336",
            background: "#fff", color: "#2b3336", fontSize: "13px", fontWeight: "700",
            cursor: "pointer", letterSpacing: "0.5px", transition: "all 0.2s",
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
      </header>

      {/* MAIN CONTENT */}
      <main style={{ padding: "40px 32px", maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "32px" }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{
            background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)", padding: "28px"
          }}>
            <h2 style={{ fontSize: "22px", color: "#2b3336", margin: "0 0 8px", fontWeight: "800" }}>
              Claim a Shift
            </h2>
            <p style={{ color: "#666", fontSize: "13px", margin: "0 0 24px", lineHeight: "1.5" }}>
              Select an upcoming event and secure your time slot to help feed the community.
            </p>

            <form onSubmit={bookShift} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#2b3336", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Full Name
                </label>
                <input required placeholder="e.g. Jane Doe" value={volunteerName}
                  onChange={(e) => setVolunteerName(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1.5px solid #ddd", fontSize: "14px", marginTop: "6px", boxSizing: "border-box", background: "#f3f3f3", color: "#2b3336", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#2b3336", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Select Event
                </label>
                <select value={selectedEventId}
                  onChange={(e) => { setSelectedEventId(e.target.value); setSelectedTimeSlot(""); }}
                  style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1.5px solid #ddd", fontSize: "14px", marginTop: "6px", boxSizing: "border-box", background: "#f3f3f3", color: "#2b3336", outline: "none" }}
                  required>
                  <option value="" disabled>-- Available Events --</option>
                  {events.map(evt => (
                    <option key={evt.id} value={evt.id}>{evt.title} ({evt.date})</option>
                  ))}
                </select>
              </div>

              {selectedEventId && (
                <div>
                  <label style={{ fontSize: "11px", color: "#2b3336", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Available Time Slots
                  </label>
                  <select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1.5px solid #ddd", fontSize: "14px", marginTop: "6px", boxSizing: "border-box", background: "#f3f3f3", color: "#2b3336", outline: "none" }}
                    required>
                    <option value="" disabled>-- Pick a Time --</option>
                    {availableSlotsArray.map((slot: string, i: number) => (
                      <option key={i} value={slot.trim()}>{slot.trim()}</option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit"
                style={{
                  marginTop: "12px", padding: "14px", borderRadius: "6px",
                  background: "#ef3a40", color: "white", border: "none",
                  fontSize: "14px", fontWeight: "700", cursor: "pointer",
                  letterSpacing: "1px", textTransform: "uppercase",
                  boxShadow: "0 4px 14px rgba(239,58,64,0.35)", transition: "background 0.2s",
                }}
                onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#2b3336"}
                onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#ef3a40"}
              >
                Confirm My Booking
              </button>
            </form>
          </div>

          {/* INFO CARD */}
          <div style={{
            background: "#2b3336", borderRadius: "12px",
            padding: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", color: "white"
          }}>
            <h4 style={{ fontSize: "16px", margin: "0 0 12px", fontWeight: "800", letterSpacing: "-0.3px" }}>
              Before you arrive...
            </h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: "1.8" }}>
              <li>Please arrive 15 minutes before your shift.</li>
              <li>Wear comfortable, closed-toe shoes.</li>
              <li>If you cannot make it, please cancel your shift so another volunteer can take your place.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN  */}
        <div style={{
          background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden", height: "fit-content"
        }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "18px", color: "#2b3336", margin: 0, fontWeight: "800" }}>My Active Shifts</h3>
            <span style={{ fontSize: "12px", color: "#fff", fontWeight: "700", background: "#ef3a40", padding: "4px 12px", borderRadius: "20px" }}>
              Total: {bookings.length}
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#666", fontSize: "14px" }}>Syncing with Database...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f3f3" }}>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#2b3336", textTransform: "uppercase", letterSpacing: "1px" }}>Shift Details</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#2b3336", textTransform: "uppercase", letterSpacing: "1px" }}>Status</th>
                  <th style={{ padding: "12px 24px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#2b3336", textTransform: "uppercase", letterSpacing: "1px" }}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const eventInfo = getEventData(booking.event_id);
                  const isEditing = editingBookingId === booking.id;

                  return (
                    <tr key={booking.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#2b3336", marginBottom: "4px" }}>{booking.volunteer_name}</div>
                        <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>{eventInfo ? eventInfo.title : "Loading..."}</div>

                        {isEditing ? (
                          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                            <select onChange={(e) => setEditNewSlot(e.target.value)}
                              style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #ddd", fontSize: "11px", background: "#f3f3f3" }}>
                              <option value="">Change slot...</option>
                              {eventInfo?.time_slots.split(",").map((slot: string, i: number) => (
                                <option key={i} value={slot.trim()}>{slot.trim()}</option>
                              ))}
                            </select>
                            <button onClick={() => saveUpdatedSlot(booking.id)}
                              style={{ padding: "4px 10px", background: "#ef3a40", color: "white", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                              Save
                            </button>
                            <button onClick={() => setEditingBookingId(null)}
                              style={{ padding: "4px 10px", background: "#f3f3f3", color: "#2b3336", border: "1px solid #ddd", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#2b3336", background: "#f3f3f3", display: "inline-block", padding: "3px 8px", borderRadius: "4px", fontWeight: "600" }}>
                            ⏱️ {booking.selected_slot}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", fontWeight: "700", background: "#ef3a40", color: "#fff" }}>
                          {booking.status}
                        </span>
                      </td>

                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          {!isEditing && (
                            <button onClick={() => { setEditingBookingId(booking.id); setEditNewSlot(booking.selected_slot); }}
                              style={{ padding: "6px 12px", background: "#fff", color: "#2b3336", border: "1.5px solid #ddd", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                              Change
                            </button>
                          )}
                          <button onClick={() => cancelBooking(booking.id)}
                            style={{ padding: "6px 12px", background: "#ef3a40", color: "#fff", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {bookings.length === 0 && !isLoading && (
            <div style={{ padding: "32px", textAlign: "center", color: "#666", fontSize: "14px" }}>
              You have no active shifts. Claim one on the left!
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <p style={{ textAlign: "center", fontSize: "12px", color: "#2b3336", opacity: 0.4, paddingBottom: "32px" }}>
        © 2025 Ladles of Love · Nourishing communities, one ladle at a time.
      </p>
    </div>
  );
}