"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// --- CLOUD CONNECTION ---
const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w"; // Paste your Anon Key!
const supabase = createClient(supabaseUrl, supabaseKey);

export default function VolunteerBooking() {
  const router = useRouter();
  
  // --- DATABASE STATE ---
  const [events, setEvents] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- FORM STATE ---
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [volunteerName, setVolunteerName] = useState("");

  // --- EDIT STATE ---
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [editNewSlot, setEditNewSlot] = useState("");

  // --- ENGINE DRIVER ---
  useEffect(() => { 
    fetchData(); 
  }, []);

  async function fetchData() {
    setIsLoading(true);
    const { data: eData } = await supabase.from("events").select("*");
    if (eData) setEvents(eData);

    const { data: bData } = await supabase.from("bookings").select("*").order("id", { ascending: false });
    if (bData) setBookings(bData);
    setIsLoading(false);
  }

  // --- CRUD FUNCTIONS ---
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

  // --- HELPER FUNCTIONS ---
  function getEventData(eventId: number) {
    return events.find(e => e.id === eventId);
  }

  const currentEventObj = events.find(e => e.id.toString() === selectedEventId);
  const availableSlotsArray = currentEventObj ? currentEventObj.time_slots.split(",") : [];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f4f0ea", color: "#333", fontFamily: "'Trebuchet MS', sans-serif" }}>
      
      {/* TOP NAVIGATION */}
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #ede4d4",
        padding: "0 32px",
        height: "70px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "26px" }}>🍲</span>
          <div>
            <h1 style={{ fontFamily: "'Georgia', serif", color: "#16a34a", margin: 0, fontSize: "18px", fontWeight: "700" }}>
              Ladles of Love
            </h1>
            <div style={{ fontSize: "11px", color: "#8c6a40", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: "600" }}>
              Volunteer Portal
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button 
            onClick={() => router.push("/admin")} 
            style={{ 
              padding: "7px 16px", borderRadius: "8px", border: "1.5px solid #e8d5b5", 
              background: "#fff8f0", color: "#d4780a", fontSize: "13px", fontWeight: "600", cursor: "pointer" 
            }}
          >
            ← Admin Dashboard
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{ padding: "40px 32px", maxWidth: "1000px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "32px" }}>
        
        {/* LEFT COLUMN: REGISTRATION FORM */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{
            background: "#fff", borderRadius: "16px", border: "1px solid #ede4d4", 
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)", padding: "28px"
          }}>
            <h2 style={{ fontFamily: "'Georgia', serif", fontSize: "22px", color: "#2d1200", margin: "0 0 8px", fontWeight: "700" }}>
              Claim a Shift
            </h2>
            <p style={{ color: "#8c6a40", fontSize: "13px", margin: "0 0 24px 0", lineHeight: "1.4" }}>
              Select an upcoming event and secure your time slot to help feed the community.
            </p>

            <form onSubmit={bookShift} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>FULL NAME</label>
                <input required placeholder="e.g. Jane Doe" value={volunteerName} onChange={(e) => setVolunteerName(e.target.value)} 
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #f0e4d0", fontSize: "14px", marginTop: "6px", boxSizing: "border-box", background: "#fdf8f2" }} 
                />
              </div>
              
              <div>
                <label style={{ fontSize: "11px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>SELECT EVENT</label>
                <select value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSelectedTimeSlot(""); }} 
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #f0e4d0", fontSize: "14px", marginTop: "6px", boxSizing: "border-box", background: "#fdf8f2" }} required>
                  <option value="" disabled>-- Available Events --</option>
                  {events.map(evt => (
                    <option key={evt.id} value={evt.id}>{evt.title} ({evt.date})</option>
                  ))}
                </select>
              </div>

              {selectedEventId && (
                <div>
                  <label style={{ fontSize: "11px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>AVAILABLE TIME SLOTS</label>
                  <select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)} 
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #f0e4d0", fontSize: "14px", marginTop: "6px", boxSizing: "border-box", background: "#fdf8f2" }} required>
                    <option value="" disabled>-- Pick a Time --</option>
                    {availableSlotsArray.map((slot: string, i: number) => (
                      <option key={i} value={slot.trim()}>{slot.trim()}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <button type="submit" style={{ 
                marginTop: "12px", padding: "14px", borderRadius: "8px", background: "linear-gradient(135deg, #16a34a, #15803d)", 
                color: "white", border: "none", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.3)" 
              }}>
                Confirm My Booking
              </button>
            </form>
          </div>

          {/* QUICK INFO CARD */}
          <div style={{ background: "linear-gradient(135deg, #2d1200, #7c3300)", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", color: "white" }}>
            <h4 style={{ fontFamily: "'Georgia', serif", fontSize: "16px", margin: "0 0 12px", fontWeight: "700" }}>Before you arrive...</h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "rgba(255,240,200,0.9)", lineHeight: "1.6" }}>
              <li>Please arrive 15 minutes before your shift.</li>
              <li>Wear comfortable, closed-toe shoes.</li>
              <li>If you cannot make it, please cancel your shift so another volunteer can take your place.</li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE ROSTER TABLE */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #ede4d4", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", overflow: "hidden", height: "fit-content" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0e4d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#2d1200", margin: 0, fontWeight: "700" }}>My Active Shifts</h3>
            <span style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "600", background: "#f4f0ea", padding: "4px 10px", borderRadius: "12px" }}>Total: {bookings.length}</span>
          </div>

          {isLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#8c6a40", fontSize: "14px" }}>Syncing with Database...</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fdf8f2" }}>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#8c6a40", textTransform: "uppercase" }}>Shift Details</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#8c6a40", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "12px 24px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#8c6a40", textTransform: "uppercase" }}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const eventInfo = getEventData(booking.event_id);
                  const isEditing = editingBookingId === booking.id;
                  
                  return (
                    <tr key={booking.id} style={{ borderBottom: "1px solid #f8f2ea" }}>
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#2d1200", marginBottom: "4px" }}>{booking.volunteer_name}</div>
                        <div style={{ fontSize: "12px", color: "#5c3a1a", marginBottom: "4px" }}>{eventInfo ? eventInfo.title : "Loading..."}</div>
                        
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                            <select onChange={(e) => setEditNewSlot(e.target.value)} style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px" }}>
                              <option value="">Change slot...</option>
                              {eventInfo?.time_slots.split(",").map((slot: string, i: number) => (
                                <option key={i} value={slot.trim()}>{slot.trim()}</option>
                              ))}
                            </select>
                            <button onClick={() => saveUpdatedSlot(booking.id)} style={{ padding: "4px 10px", background: "#16a34a", color: "white", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Save</button>
                            <button onClick={() => setEditingBookingId(null)} style={{ padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#8c6a40", background: "#f4f0ea", display: "inline-block", padding: "3px 8px", borderRadius: "4px", fontWeight: "600" }}>
                            ⏱️ {booking.selected_slot}
                          </div>
                        )}
                      </td>
                      
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", fontWeight: "700", background: "#dcfce7", color: "#16a34a" }}>
                          {booking.status}
                        </span>
                      </td>

                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          {!isEditing && (
                            <button onClick={() => { setEditingBookingId(booking.id); setEditNewSlot(booking.selected_slot); }} 
                              style={{ padding: "6px 12px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                              Change
                            </button>
                          )}
                          <button onClick={() => cancelBooking(booking.id)} 
                            style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
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
            <div style={{ padding: "32px", textAlign: "center", color: "#8c6a40", fontSize: "14px" }}>
              You have no active shifts. Claim one on the left!
            </div>
          )}
        </div>

      </main>
    </div>
  );
}