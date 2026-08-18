"use client";
import { Event, Booking, Volunteer } from "../../../lib/types";
import { useState } from "react";

export default function VolunteerView({ volunteers, events, bookings }: { volunteers: Volunteer[], events: Event[], bookings: Booking[] }) {
  // State to track which event the admin selects from the dropdown
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [localBookings, setLocalBookings] = useState<any[]>(bookings);

  const currentRoster = localBookings.filter(
    (booking) => booking.event_id.toString() === selectedEventId
  );

  function handleToggleAttendance(bookingId: number, currentStatus: string) {
    const newStatus = currentStatus === "Present" ? "Confirmed" : "Present";
    setLocalBookings(prev => 
      prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
    );

    //Add Supabase code here to save to the database permanently
  }

  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      
      {/* HEADER & DROPDOWN */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
        <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Track Attendance</h3>
        
        <select 
          value={selectedEventId} 
          onChange={(e) => setSelectedEventId(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none", minWidth: "250px", cursor: "pointer", fontWeight: "600" }}
        >
          <option value="">-- Select an Event to view roster --</option>
          {events.map(evt => (
            <option key={evt.id} value={evt.id}>{evt.title} ({evt.date})</option>
          ))}
        </select>
      </div>

      {/* ROSTER TABLE */}
      {selectedEventId === "" ? (
        <div style={{ padding: "60px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
          Please select an event from the dropdown above to view the volunteer roster.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fff", borderBottom: "2px solid #f1f5f9" }}>
              {["Volunteer", "Time Slot", "Status", "Action"].map((col) => (
                <th key={col} style={{ padding: "14px 24px", textAlign: col === "Action" ? "right" : "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRoster.map((booking, index) => (
              <tr key={booking.id} style={{ borderBottom: index < currentRoster.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: "700", color: "#1a1a1a" }}>{booking.volunteer_name}</td>
                <td style={{ padding: "16px 24px", fontSize: "13px", color: "#64748b", fontWeight: "600" }}>{booking.selected_slot}</td>
                <td style={{ padding: "16px 24px" }}>
                  <span style={{ 
                    padding: "6px 10px", 
                    background: booking.status === "Present" ? "#dcfce7" : "#f1f5f9", 
                    color: booking.status === "Present" ? "#16a34a" : "#475569", 
                    borderRadius: "6px", 
                    fontSize: "11px", 
                    fontWeight: "800",
                    letterSpacing: "0.5px"
                  }}>
                    {booking.status === "Present" ? "✓ PRESENT" : "AWAITING"}
                  </span>
                </td>
                <td style={{ padding: "16px 24px", textAlign: "right" }}>
                  <button 
                    onClick={() => handleToggleAttendance(booking.id, booking.status)}
                    style={{ 
                      padding: "8px 16px", 
                      borderRadius: "6px", 
                      border: booking.status === "Present" ? "1px solid #fecaca" : "none",
                      background: booking.status === "Present" ? "#fff" : "#1a1a1a", 
                      color: booking.status === "Present" ? "#e62b32" : "#fff",
                      fontSize: "12px", 
                      fontWeight: "700", 
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    {booking.status === "Present" ? "Undo" : "Mark Present"}
                  </button>
                </td>
              </tr>
            ))}
            {currentRoster.length === 0 && (
              <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>No volunteers have booked this shift yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}