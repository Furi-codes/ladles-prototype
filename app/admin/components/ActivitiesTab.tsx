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

  // --- POP-UP STATE ---
  const [showPopup, setShowPopup] = useState(false);
  const [popupSettings, setPopupSettings] = useState({
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const today = new Date().toISOString().split("T")[0];

  // --- EVENT CRUD ---
  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const actionText = editingEventId ? "save these changes" : "publish this new event";
    
    setPopupSettings({
      title: editingEventId ? "Confirm Changes" : "Confirm Publication",
      message: `Are you sure you want to ${actionText}?`,
      onConfirm: async () => {
        const eventData = { title, date, location, time_slots: timeSlots, total_slots: parseInt(slots) };
        await upsertEvent(eventData, editingEventId);
        setTitle(""); setDate(""); setLocation(""); setTimeSlots(""); setSlots(""); setEditingEventId(null);
        fetchData(); 
        setShowPopup(false); 
      }
    });
    setShowPopup(true);
  }

  function triggerEditEvent(evt: any) {
    // Triggers pop-up before pulling data into the form
    setPopupSettings({
      title: "Edit Event",
      message: "Are you sure you want to edit this event? This will load its details into the form.",
      onConfirm: () => {
        setEditingEventId(evt.id);
        setTitle(evt.title);
        setDate(evt.date);
        setLocation(evt.location);
        setTimeSlots(evt.time_slots);
        setSlots(evt.total_slots.toString());
        setShowPopup(false); // Close pop-up after loading
      }
    });
    setShowPopup(true);
  }

  function triggerDelete(id: number) {
    setPopupSettings({
      title: "Delete Event",
      message: "Are you sure you want to delete this event? This action cannot be undone.",
      onConfirm: async () => {
        await removeEventFromDB(id);
        fetchData(); 
        setShowPopup(false); 
      }
    });
    setShowPopup(true);
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
        
        {/* EVENT LIST COLUMN */}
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
                    <button onClick={() => triggerDelete(evt.id)} style={{ padding: "6px 12px", background: "#fef2f2", color: "#e62b32", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
              ))}
              {events.length === 0 && <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center", padding: "20px" }}>No events created yet.</p>}
            </div>
          )}
        </div>

        {/* CREATE/EDIT FORM COLUMN */}
        <div>
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "24px", position: "sticky", top: "90px" }}>
            <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: "0 0 20px", fontWeight: "700" }}>
              {editingEventId ? "✏️ Edit Event" : "➕ Create Event"}
            </h3>
            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>TITLE</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>DATE</label>
                <input required type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>LOCATION</label>
                <input required value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>TIME SLOTS</label>
                <input 
                  required 
                  placeholder="09:00, 13:00" 
                  value={timeSlots} 
                  onChange={(e) => {
                    const cleanedInput = e.target.value.replace(/[^0-9:, ]/g, '');
                    setTimeSlots(cleanedInput);
                  }} 
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} 
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", letterSpacing: "0.5px" }}>CAPACITY</label>
                {/* Added min="1" to permanently block zero or negative numbers */}
                <input required type="number" min="1" value={slots} onChange={(e) => setSlots(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", fontSize: "13px" }} />
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

      {/* POP-UP */}
      {showPopup && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "18px", color: "#1a1a1a", margin: 0, fontWeight: "800" }}>{popupSettings.title}</h3>
            </div>
            <div style={{ padding: "24px", fontSize: "14px", color: "#475569", lineHeight: "1.5" }}>
              {popupSettings.message}
            </div>
            <div style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setShowPopup(false)}
                style={{ padding: "10px 16px", borderRadius: "6px", background: "#fff", border: "1px solid #cbd5e1", color: "#475569", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button 
                onClick={popupSettings.onConfirm}
                style={{ padding: "10px 16px", borderRadius: "6px", background: "#e62b32", border: "none", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}