"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import VolunteerView from "./components/VolunteerNav";
import PageHeader from "./components/PageHeader";
// --- CRUD SERVICE ---
import { getEvents, getBookings, getVolunteers, upsertEvent, deleteEvent as removeEventFromDB, deleteBooking as removeBookingFromDB } from "../../lib/admin-actions";


// --- THE BLUEPRINTS --- (defining what each object must consist of)
interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  time_slots: string;
  total_slots: number;
}

interface Booking {
  id: number;
  event_id: number;
  volunteer_name: string;
  selected_slot: string;
  status: string;
}

interface Volunteer {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  
  // --- UI STATE ---
  const [activeNav, setActiveNav] = useState("Dashboard");

  // --- DATABASE STATE ---
  const [events, setEvents] = useState<Event[]>([]); // events is current value, setEvents is the function to update it.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- FORM STATE ---
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [timeSlots, setTimeSlots] = useState("");
  const [slots, setSlots] = useState("");
  const [editingEventId, setEditingEventId] = useState<number | null>(null); // null means no event is being edited, otherwise it holds the ID of the event being edited.

  // --- ENGINE DRIVER ---
  useEffect(() => {
    fetchData();
  }, []); // the [] tells it to run once on page load. 

  async function fetchData() { //async means it will run in the background and not block the UI.
    setIsLoading(true);
    
    const { data: eData } = await getEvents();
    if (eData) setEvents(eData); // safety net in case the table is empty

    const { data: bData } = await getBookings();
    if (bData) setBookings(bData);

    const { data: vData } = await getVolunteers();
    if (vData) setVolunteers(vData);

    setIsLoading(false);// finish loading once data is fetched.
  }

  // --- EVENT CRUD ---
  async function saveEvent(e: React.FormEvent) {
    e.preventDefault(); // prevent the default form submission behavior (which would reload the page).
    const eventData = { title, date, location, time_slots: timeSlots, total_slots: parseInt(slots) };
    await upsertEvent(eventData, editingEventId);
    setTitle(""); setDate(""); setLocation(""); setTimeSlots(""); setSlots(""); setEditingEventId(null);
    fetchData();
  }

  function triggerEditEvent(evt: Event) {
    setEditingEventId(evt.id);
    setTitle(evt.title);
    setDate(evt.date);
    setLocation(evt.location);
    setTimeSlots(evt.time_slots);
    setSlots(evt.total_slots.toString());
  }

  async function deleteEvent(id: number) {
    await removeEventFromDB(id);
    fetchData();
  }

  // --- BOOKING CRUD ---
  async function removeBooking(id: number) {
    await removeBookingFromDB(id);
    fetchData();
  }

  function getEventName(eventId: number) {
    const evt = events.find(e => e.id === eventId);
    return evt ? evt.title : "Unknown Event";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", fontFamily: "'Montserrat', 'Segoe UI', Roboto, Helvetica, sans-serif" }}>

      {/* SIDEBAR (Locked in place) */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      {/* MAIN CONTENT AREA */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Nav Header (Locked in place) */}
        <TopHeader activeNav={activeNav} />

        {/* Dynamic Page Body */}
        <main style={{ padding: "32px", flex: 1 }}>
          
          {/* Dynamic Page Title */}
          <PageHeader activeNav={activeNav} />

          {/* ========================================== */}
          {/* TAB 1: DASHBOARD (Metrics & Live Feed Only) */}
          {/* ========================================== */}
          {activeNav === "Dashboard" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
                {[
                  { label: "Total Bookings", value: bookings.length.toString(), icon: "👥", change: "Live Sync", up: true },
                  { label: "Active Events", value: events.length.toString(), icon: "📋", change: "In database", up: true },
                  { label: "Registered Volunteers", value: volunteers.length.toString(), icon: "❤️", change: "Community", up: true },
                  { label: "System Status", value: isLoading ? "Syncing" : "Ready", icon: "⚡", change: "Supabase connected", up: true },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize: "22px", marginBottom: "8px" }}>{stat.icon}</div>
                    <div style={{ fontSize: "26px", fontWeight: "800", color: "#1a1a1a", lineHeight: 1, marginBottom: "4px" }}>{stat.value}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", marginBottom: "2px" }}>{stat.label}</div>
                    <div style={{ fontSize: "11px", color: stat.up ? "#16a34a" : "#64748b", fontWeight: "700" }}>{stat.change}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Live Bookings Feed</h3>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Volunteer", "Event", "Slot", "Status"].map((col) => (
                        <th key={col} style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 5).map((row, index) => (
                      <tr key={row.id} style={{ borderBottom: index < 4 ? "1px solid #f1f5f9" : "none" }}>
                        <td style={{ padding: "14px 24px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{row.volunteer_name}</td>
                        <td style={{ padding: "14px 24px", fontSize: "13px", color: "#475569" }}>{getEventName(row.event_id)}</td>
                        <td style={{ padding: "14px 24px", fontSize: "12px", color: "#64748b" }}>{row.selected_slot}</td>
                        <td style={{ padding: "14px 24px" }}>
                          <span style={{ padding: "4px 8px", background: "#dcfce7", color: "#16a34a", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>Confirmed</span>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No recent bookings.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ========================================== */}
          {/* TAB 2: MANAGE ACTIVITIES (Events List + Form) */}
          {/* ========================================== */}
          {activeNav === "Manage Activities" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", alignSelf: "start" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>All Activities</h3>
                </div>
                {isLoading ? <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>Loading events...</div> : (
                  <div style={{ padding: "8px 24px" }}>
                    {events.map((evt) => (
                      <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <div>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a", marginBottom: "6px" }}>{evt.title}</div>
                          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>📍 {evt.location} &nbsp;|&nbsp; 📅 {evt.date}</div>
                          <div style={{ fontSize: "12px", color: "#475569", background: "#f1f5f9", display: "inline-block", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
                            Shifts: {evt.time_slots} (Max: {evt.total_slots})
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => triggerEditEvent(evt)} style={{ padding: "6px 12px", background: "#f8fafc", color: "#333", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => deleteEvent(evt.id)} style={{ padding: "6px 12px", background: "#fef2f2", color: "#e62b32", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Delete</button>
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center", padding: "20px" }}>No events created yet.</p>}
                  </div>
                )}
              </div>

              <div>
                <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "24px", position: "sticky", top: "90px" }}>
                  <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: "0 0 20px", fontWeight: "700" }}>
                    {editingEventId ? "✏️ Edit Event" : "➕ Create Event"}
                  </h3>
                  <form onSubmit={saveEvent} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>TITLE</label>
                      <input required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>DATE</label>
                      <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>LOCATION</label>
                      <input required value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>TIME SLOTS</label>
                      <input required placeholder="09:00, 13:00" value={timeSlots} onChange={(e) => setTimeSlots(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>CAPACITY</label>
                      <input required type="number" value={slots} onChange={(e) => setSlots(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
                    </div>
                    
                    <button type="submit" style={{ marginTop: "8px", width: "100%", padding: "12px", borderRadius: "8px", background: "#e62b32", color: "white", border: "none", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "background 0.2s" }}>
                      {editingEventId ? "Save Changes" : "Publish Event"}
                    </button>
                    {editingEventId && (
                      <button type="button" onClick={() => { setEditingEventId(null); setTitle(""); setDate(""); setLocation(""); setTimeSlots(""); setSlots(""); }} style={{ width: "100%", padding: "8px", background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                        Cancel
                      </button>
                    )}
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* TAB 3: VOLUNTEERS (CRM Table) */}
          {/* ========================================== */}
          {activeNav === "Volunteers" && (
            <VolunteerView volunteers={volunteers} />
          )}

          {/* ========================================== */}
          {/* PLACEHOLDERS FOR REMAINING TABS */}
          {/* ========================================== */}
          {["Corporate CSR", "Export Reports", "Settings"].includes(activeNav) && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px dashed #cbd5e1", padding: "60px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🛠️</div>
              <h3 style={{ fontSize: "18px", color: "#1a1a1a", margin: "0 0 8px", fontWeight: "700" }}>{activeNav} Module</h3>
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>This section is currently under construction for the prototype phase.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}