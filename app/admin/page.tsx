"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

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

// --- CONSTANTS & STYLES ---
const navLinks = [
  { label: "Dashboard", icon: "📊" },
  { label: "Manage Activities", icon: "📅" },
  { label: "Volunteers", icon: "👥" },
  { label: "Corporate CSR", icon: "🏢" },
  { label: "Export Reports", icon: "📤" },
  { label: "Settings", icon: "⚙️" },
];

// --- CLOUD CONNECTION ---
const supabaseUrl = "https://lkczfrnuksjxsimbcxkz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrY3pmcm51a3NqeHNpbWJjeGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODc2ODIsImV4cCI6MjA5NDE2MzY4Mn0.xN3DDINaA9nn0d4do4MrJ9XFlkNKBZuRPQBi3qIUU2w"; 

export default function AdminDashboard() {
  const router = useRouter();
  
  // --- UI STATE ---
  const [activeNav, setActiveNav] = useState("Dashboard");

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

  // Subscribe to booking changes
  const subscription = supabase
    .channel('admin-bookings')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings'
      },
      (payload) => {
        console.log('📊 Admin: Booking changed:', payload);
        fetchData();
      }
    )
    .subscribe();

  // Also subscribe to event changes
  const eventSubscription = supabase
    .channel('admin-events')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'events'
      },
      (payload) => {
        console.log('📊 Admin: Event changed:', payload);
        fetchData();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
    eventSubscription.unsubscribe();
  };
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
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", fontFamily: "'Montserrat', 'Segoe UI', Roboto, Helvetica, sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width: "240px", background: "#ffffff", borderRight: "1px solid #e2e8f0", flexShrink: 0, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Make sure your logo is named logo.jpeg or logo.png in the public folder! */}
            <Image src="/newLogo.png" alt="Ladles of Love Logo" width={45} height={45} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ color: "#1a1a1a", fontSize: "16px", fontWeight: "800", lineHeight: 1.1, letterSpacing: "-0.5px" }}>
                Ladles of Love
              </div>
              <div style={{ fontSize: "10px", color: "#e62b32", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>
                Admin Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
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

        {/* Bottom User Card */}
        <div style={{ padding: "16px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "13px", flexShrink: 0 }}>
            JJ
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#1a1a1a", fontWeight: "700" }}>Joe Johnson</div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>Operations Lead</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Nav Header */}
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Admin Dashboard</span>
            <span style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>Live Database</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => router.push("/volunteer")}
              style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fef2f2", color: "#e62b32", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
            >
              ← Switch to Volunteer View
            </button>
            <div style={{ padding: "5px 12px", borderRadius: "20px", background: "#1a1a1a", border: "1px solid #333", fontSize: "12px", color: "#ffffff", fontWeight: "600" }}>
              🔴 Online
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main style={{ padding: "32px", flex: 1 }}>
          <div style={{ marginBottom: "28px" }}>
           <h2 style={{ 
  fontFamily: "'montserrat-black', 'Montserrat', sans-serif", 
  fontSize: "42px", 
  fontWeight: 900, 
  margin: 0,
  letterSpacing: "-0.5px"
}}>
  {/* The Outline Text */}
  <span style={{ 
    color: "transparent", 
    WebkitTextStroke: "1.5px #262626" 
  }}>
    More ways{" "}
  </span>
  
  {/* The Solid Text */}
  <span style={{ 
    color: "#262626" 
  }}>
    to get involved
  </span>
</h2>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0" }}>Cape Town & Johannesburg · Real-time overview</p>
          </div>

          {/* Stats Row (Now linked to actual data!) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
            {[
              { label: "Total Bookings", value: bookings.length.toString(), icon: "👥", change: "Live Sync", up: true },
              { label: "Active Events", value: events.length.toString(), icon: "📋", change: "In database", up: true },
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

          {/* Two Column Layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
            
            {/* LEFT COLUMN: Feeds */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Event Feed */}
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Active Events</h3>
                </div>
                {isLoading ? <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>Loading events...</div> : (
                  <div style={{ padding: "8px 24px" }}>
                    {events.map((evt) => (
                      <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <div>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a", marginBottom: "6px" }}>{evt.title}</div>
                          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>📍 {evt.location} &nbsp;|&nbsp; 📅 {evt.date}</div>
                          <div style={{ fontSize: "12px", color: "#475569", background: "#f1f5f9", display: "inline-block", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
                            Shifts: {evt.time_slots}
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

              {/* Booking Feed */}
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Live Bookings</h3>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Volunteer", "Event", "Slot", "Actions"].map((col) => (
                        <th key={col} style={{ padding: "12px 24px", textAlign: col === "Actions" ? "right" : "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((row, index) => (
                      <tr key={row.id} style={{ borderBottom: index < bookings.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <td style={{ padding: "14px 24px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{row.volunteer_name}</td>
                        <td style={{ padding: "14px 24px", fontSize: "13px", color: "#475569" }}>{getEventName(row.event_id)}</td>
                        <td style={{ padding: "14px 24px", fontSize: "12px", color: "#64748b" }}>{row.selected_slot}</td>
                        <td style={{ padding: "14px 24px", textAlign: "right" }}>
                          <button onClick={() => removeBooking(row.id)} style={{ background: "transparent", color: "#e62b32", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* RIGHT COLUMN: Event Builder Form */}
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
                  
                  <button type="submit" style={{ marginTop: "8px", width: "100%", padding: "12px", borderRadius: "8px", background: "#e62b32", color: "white", border: "none", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "#c92026"} onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "#e62b32"}>
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
        </main>
      </div>
    </div>
  );
}