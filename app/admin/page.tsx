"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

// --- CLOUD CONNECTION ---
const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w"; // Paste your Anon Key!
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminDashboard() {
  const router = useRouter();
  
  // --- DATABASE STATE ---
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
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
  }, []);

  async function fetchData() {
    setIsLoading(true);
    const { data: eData } = await supabase.from("events").select("*").order("id", { ascending: false });
    if (eData) setEvents(eData);

    const { data: bData } = await supabase.from("bookings").select("*").order("id", { ascending: false });
    if (bData) setBookings(bData);
    setIsLoading(false);
  }

  // --- EVENT CRUD ---
  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    const eventData = { title, date, location, time_slots: timeSlots, total_slots: parseInt(slots) };

    if (editingEventId) {
      await supabase.from("events").update(eventData).eq("id", editingEventId);
      setEditingEventId(null);
    } else {
      await supabase.from("events").insert([eventData]);
    }
    setTitle(""); setDate(""); setLocation(""); setTimeSlots(""); setSlots("");
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
    await supabase.from("events").delete().eq("id", id);
    fetchData();
  }

  // --- BOOKING CRUD ---
  async function removeBooking(id: number) {
    await supabase.from("bookings").delete().eq("id", id);
    fetchData();
  }

  function getEventName(eventId: number) {
    const evt = events.find(e => e.id === eventId);
    return evt ? evt.title : "Unknown Event";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f4f0ea", fontFamily: "'Trebuchet MS', sans-serif" }}>
      
      {/* TOP NAV (Now includes branding) */}
      <header style={{ background: "#fff", borderBottom: "1px solid #ede4d4", padding: "0 32px", height: "70px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "26px" }}>🍲</span>
          <h1 style={{ fontFamily: "'Georgia', serif", color: "#d97706", margin: 0, fontSize: "20px", fontWeight: "700" }}>Ladles of Love</h1>
          <span style={{ fontSize: "14px", color: "#ddd", margin: "0 4px" }}>|</span>
          <span style={{ fontSize: "13px", color: "#b09070" }}>Admin Portal</span>
          <span style={{ fontSize: "13px", color: "#ddd", margin: "0 8px" }}>·</span>
          <span style={{ fontSize: "13px", color: "#5c3a1a", fontWeight: "600" }}>Code Week Prototype</span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => router.push("/volunteer")}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1.5px solid #e8d5b5", background: "#fff8f0", color: "#d4780a", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.2s" }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#fce8ce"}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#fff8f0"}
          >
            ← Switch to Volunteer View
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ padding: "40px", flex: 1, maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Georgia', serif", fontSize: "28px", color: "#2d1200", margin: 0, fontWeight: "700" }}>Operations Dashboard</h2>
          <p style={{ color: "#8c6a40", fontSize: "14px", margin: "6px 0 0" }}>Real-time database overview</p>
        </div>

        {/* STATS ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          {[
            { label: "Total Bookings", value: bookings.length.toString(), icon: "👥", change: "Live Sync" },
            { label: "Active Events", value: events.length.toString(), icon: "📅", change: "Live Sync" },
            { label: "System Status", value: "Online", icon: "⚡", change: "Supabase Connected" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #ede4d4", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "24px", marginBottom: "12px" }}>{stat.icon}</div>
              <div style={{ fontFamily: "'Georgia', serif", fontSize: "32px", fontWeight: "700", color: "#2d1200", lineHeight: 1, marginBottom: "8px" }}>{stat.value}</div>
              <div style={{ fontSize: "13px", color: "#5c3a1a", fontWeight: "600", marginBottom: "4px" }}>{stat.label}</div>
              <div style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "600" }}>{stat.change}</div>
            </div>
          ))}
        </div>

        {/* TWO COLUMN LOWER SECTION */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px" }}>
          
          {/* LEFT COLUMN: EVENTS & ROSTER */}
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            
            {/* Event Feed */}
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #ede4d4", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0e4d0" }}>
                <h3 style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#2d1200", margin: 0, fontWeight: "700" }}>Active Events</h3>
              </div>
              {isLoading ? <div style={{ padding: "30px", textAlign: "center", color: "#8c6a40" }}>Syncing...</div> : (
                <div style={{ padding: "16px 24px" }}>
                  {events.map((evt) => (
                    <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #f8f2ea" }}>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: "700", color: "#2d1200", marginBottom: "6px" }}>{evt.title}</div>
                        <div style={{ fontSize: "13px", color: "#b09070", marginBottom: "8px" }}>📍 {evt.location} &nbsp;|&nbsp; 📅 {evt.date}</div>
                        <div style={{ fontSize: "12px", color: "#8c6a40", background: "#f4f0ea", display: "inline-block", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
                          Shifts: {evt.time_slots}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => triggerEditEvent(evt)} style={{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Edit</button>
                        <button onClick={() => deleteEvent(evt.id)} style={{ padding: "8px 16px", background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {events.length === 0 && <p style={{ fontSize: "14px", color: "#8c6a40", textAlign: "center", padding: "20px" }}>No active events found.</p>}
                </div>
              )}
            </div>

            {/* Live Roster Feed */}
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #ede4d4", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0e4d0" }}>
                <h3 style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#2d1200", margin: 0, fontWeight: "700" }}>Live Volunteer Roster</h3>
              </div>
              {isLoading ? <div style={{ padding: "30px", textAlign: "center", color: "#8c6a40" }}>Syncing...</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#fdf8f2" }}>
                      {["Volunteer", "Event", "Slot", "Actions"].map((col) => (
                        <th key={col} style={{ padding: "14px 24px", textAlign: col === "Actions" ? "right" : "left", fontSize: "12px", fontWeight: "700", color: "#8c6a40", textTransform: "uppercase" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((row, index) => (
                      <tr key={row.id} style={{ borderBottom: index < bookings.length - 1 ? "1px solid #f8f2ea" : "none" }}>
                        <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: "600", color: "#2d1200" }}>{row.volunteer_name}</td>
                        <td style={{ padding: "16px 24px", fontSize: "14px", color: "#5c3a1a" }}>{getEventName(row.event_id)}</td>
                        <td style={{ padding: "16px 24px", fontSize: "13px", color: "#b09070" }}>{row.selected_slot}</td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <button onClick={() => removeBooking(row.id)} style={{ background: "rgba(220, 38, 38, 0.08)", color: "#dc2626", border: "1px solid rgba(220, 38, 38, 0.2)", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: EVENT BUILDER */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #ede4d4", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "24px", position: "sticky", top: "100px" }}>
              <h3 style={{ fontFamily: "'Georgia', serif", fontSize: "18px", color: "#2d1200", margin: "0 0 20px", fontWeight: "700" }}>
                {editingEventId ? "✏️ Edit Event Form" : "➕ Event Builder"}
              </h3>
              <form onSubmit={saveEvent} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>TITLE</label>
                  <input required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #f0e4d0", marginTop: "6px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>DATE</label>
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #f0e4d0", marginTop: "6px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>LOCATION</label>
                  <input required value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #f0e4d0", marginTop: "6px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>TIME SLOTS (Comma separated)</label>
                  <input required placeholder="09:00, 13:00" value={timeSlots} onChange={(e) => setTimeSlots(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #f0e4d0", marginTop: "6px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#8c6a40", fontWeight: "700", letterSpacing: "0.5px" }}>TOTAL CAPACITY</label>
                  <input required type="number" value={slots} onChange={(e) => setSlots(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #f0e4d0", marginTop: "6px", boxSizing: "border-box" }} />
                </div>
                
                <button type="submit" style={{ marginTop: "12px", width: "100%", padding: "14px", borderRadius: "8px", background: "#d97706", color: "white", border: "none", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 4px rgba(217, 119, 6, 0.2)" }}>
                  {editingEventId ? "Save Changes" : "Publish to Database"}
                </button>
                {editingEventId && (
                  <button type="button" onClick={() => { setEditingEventId(null); setTitle(""); setDate(""); setLocation(""); setTimeSlots(""); setSlots(""); }} style={{ width: "100%", padding: "10px", background: "transparent", color: "#8c6a40", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                    Cancel Edit
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}