"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
// --- CRUD SERVICE ---
import { getEvents, getBookings, getVolunteers, upsertEvent, deleteEvent as removeEventFromDB, deleteBooking as removeBookingFromDB } from "../../lib/admin-actions";

// --- THE BLUEPRINTS ---
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

// --- CONSTANTS & STYLES ---
const navLinks = [
  { label: "Dashboard", icon: "📊" },
  { label: "Manage Activities", icon: "📅" },
  { label: "Volunteers", icon: "👥" },
  { label: "Corporate CSR", icon: "🏢" },
  { label: "Export Reports", icon: "📤" },
  { label: "Settings", icon: "⚙️" },
];

export default function AdminDashboard() {
  const router = useRouter();
  
  // --- UI STATE ---
  const [activeNav, setActiveNav] = useState("Dashboard");

  // --- DATABASE STATE ---
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- FORM STATE ---
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [timeSlots, setTimeSlots] = useState("");
  const [slots, setSlots] = useState("");
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  // --- ENGINE DRIVER ---
  useEffect(() => {
    fetchData();
  }, []); // the [] tells it to run once on page load. 

  async function fetchData() {
    setIsLoading(true);
    
    const { data: eData } = await getEvents();
    if (eData) setEvents(eData); // safety net in case the table doesn't exist yet, or is empty

    const { data: bData } = await getBookings();
    if (bData) setBookings(bData);

    const { data: vData } = await getVolunteers();
    if (vData) setVolunteers(vData);

    setIsLoading(false);
  }

  // --- EVENT CRUD ---
  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
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
      <aside style={{ width: "240px", background: "#ffffff", borderRight: "1px solid #e2e8f0", flexShrink: 0, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Image src="/newLogo.png" alt="Ladles of Love Logo" width={45} height={45} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ color: "#1a1a1a", fontSize: "16px", fontWeight: "800", lineHeight: 1.1, letterSpacing: "-0.5px" }}>Ladles of Love</div>
              <div style={{ fontSize: "10px", color: "#e62b32", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>Admin Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navLinks.map((link) => {
            const isActive = activeNav === link.label;
            return (
              <button
                key={link.label}
                onClick={() => setActiveNav(link.label)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "none", background: isActive ? "#fef2f2" : "transparent", color: isActive ? "#e62b32" : "#64748b", fontSize: "13px", fontWeight: isActive ? "700" : "600", cursor: "pointer", textAlign: "left", marginBottom: "4px", transition: "background 0.15s, color 0.15s", borderLeft: isActive ? "3px solid #e62b32" : "3px solid transparent" }}
                onMouseOver={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; }}
                onMouseOut={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span>{link.icon}</span> {link.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "16px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "13px", flexShrink: 0 }}>JJ</div>
          <div>
            <div style={{ fontSize: "12px", color: "#1a1a1a", fontWeight: "700" }}>Joe Johnson</div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>Operations Lead</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Nav Header (Locked in place) */}
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Admin Dashboard</span>
            <span style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>{activeNav}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/volunteer")} style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#e62b32", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              ← Switch to Volunteer View
            </button>
            <div style={{ padding: "5px 12px", borderRadius: "20px", background: "#1a1a1a", border: "1px solid #333", fontSize: "12px", color: "#ffffff", fontWeight: "600" }}>🔴 Online</div>
          </div>
        </header>

        {/* Dynamic Page Body */}
        <main style={{ padding: "32px", flex: 1 }}>
          
          {/* Dynamic Page Title */}
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontFamily: "'montserrat-black', 'Montserrat', sans-serif", fontSize: "42px", fontWeight: 900, margin: 0, letterSpacing: "-0.5px" }}>
              {activeNav === "Dashboard" && (
                <><span style={{ color: "transparent", WebkitTextStroke: "1.5px #262626" }}>More ways </span><span style={{ color: "#262626" }}>to get involved</span></>
              )}
              {activeNav === "Manage Activities" && <span style={{ color: "#262626" }}>Manage Activities</span>}
              {activeNav === "Volunteers" && <span style={{ color: "#262626" }}>Volunteer Directory</span>}
              {["Corporate CSR", "Export Reports", "Settings"].includes(activeNav) && <span style={{ color: "#262626" }}>{activeNav}</span>}
            </h2>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0" }}>Cape Town & Johannesburg · Real-time overview</p>
          </div>

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
             <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Registered Users</h3>
                <input placeholder="Search volunteers..." style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }} />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Name", "Email Address", "Role", "Actions"].map((col) => (
                      <th key={col} style={{ padding: "12px 24px", textAlign: col === "Actions" ? "right" : "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {volunteers.map((vol, index) => (
                    <tr key={vol.id} style={{ borderBottom: index < volunteers.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "14px 24px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{vol.full_name || "N/A"}</td>
                      <td style={{ padding: "14px 24px", fontSize: "13px", color: "#475569" }}>{vol.email || "N/A"}</td>
                      <td style={{ padding: "14px 24px", fontSize: "12px" }}>
                        <span style={{ padding: "4px 8px", background: vol.role === "admin" ? "#fef2f2" : "#f1f5f9", color: vol.role === "admin" ? "#e62b32" : "#475569", borderRadius: "4px", fontWeight: "700" }}>
                          {vol.role || "volunteer"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 24px", textAlign: "right" }}>
                        <button style={{ background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>View Profile</button>
                      </td>
                    </tr>
                  ))}
                  {volunteers.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No volunteers found. Make sure your profiles table exists!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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