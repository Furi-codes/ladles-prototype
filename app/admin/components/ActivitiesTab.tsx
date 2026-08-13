"use client";
import { useState } from "react";
import { upsertEvent, deleteEvent as removeEventFromDB } from "../../../lib/admin-actions";

export default function ActivitiesTab({ events, isLoading, fetchData }: { events: any[], isLoading: boolean, fetchData: () => void }) {
  // --- FORM STATE ---
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [timeSlots, setTimeSlots] = useState("");
  const [slots, setSlots] = useState("");
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  // --- EVENT CRUD ---
  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    const eventData = { title, date, location, time_slots: timeSlots, total_slots: parseInt(slots) };
    await upsertEvent(eventData, editingEventId);
    setTitle(""); setDate(""); setLocation(""); setTimeSlots(""); setSlots(""); setEditingEventId(null);
    fetchData(); // Refreshes the data on the main page
  }

  function triggerEditEvent(evt: any) {
    setEditingEventId(evt.id);
    setTitle(evt.title);
    setDate(evt.date);
    setLocation(evt.location);
    setTimeSlots(evt.time_slots);
    setSlots(evt.total_slots.toString());
  }

  async function deleteEvent(id: number) {
    await removeEventFromDB(id);
    fetchData(); // Refreshes the data on the main page
  }

  return (
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
  );
}