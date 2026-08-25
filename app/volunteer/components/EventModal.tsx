"use client";
import React from "react";
import type { Event, Booking } from "@/lib/types";

export default function EventModal({
  event,
  bookings,
  selectedTimeSlot,
  setSelectedTimeSlot,
  onClose,
  onSubmit,
  isUserBookedForEvent,
  getBookingForEvent,
  isSubmitting,
  bookingMessage,
  profile,
  user,
}: {
  event: Event | null;
  bookings: Booking[];
  selectedTimeSlot: string;
  setSelectedTimeSlot: (s: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
  isUserBookedForEvent: (eventId: number) => boolean;
  getBookingForEvent: (eventId: number) => Booking | null;
  isSubmitting: boolean;
  bookingMessage: { type: 'success' | 'error'; text: string } | null;
  profile?: any;
  user?: any;
}) {
  if (!event) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "500px", width: "90%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "slideUp 0.3s ease-out" }}>
        <button onClick={onClose} style={{ float: "right", background: "none", border: "none", fontSize: "28px", color: "#999", cursor: "pointer", padding: "0 4px" }}>×</button>

        <h2 style={{ fontSize: "24px", color: "#2b3336", margin: "0 0 8px", fontWeight: "800" }}>{event.title}</h2>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "6px" }}>📅 {event.date}</div>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "6px" }}>📍 {event.location}</div>
          <div style={{ fontSize: "14px", color: "#666", marginBottom: "6px" }}>👥 Capacity: {event.total_slots} volunteers</div>
          {event.description && (<div style={{ fontSize: "14px", color: "#555", marginTop: "12px", lineHeight: "1.6" }}>{event.description}</div>)}
        </div>

        {!isUserBookedForEvent(event.id) ? (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", color: "#2b3336", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Select Time Slot</label>
              <select required value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "6px", border: "1.5px solid #ddd", fontSize: "14px", background: "#f8f8f8", color: "#2b3336", outline: "none" }}>
                <option value="" disabled>Choose a time slot</option>
                {event.time_slots.split(",").map((slot: string, i: number) => {
                  const isBooked = bookings.some(b => b.event_id === event.id && b.selected_slot === slot.trim());
                  return (<option key={i} value={slot.trim()} disabled={isBooked} style={{ color: isBooked ? "#999" : "#2b3336" }}>{slot.trim()} {isBooked ? "🔴 (Taken)" : ""}</option>);
                })}
              </select>
            </div>

            <div style={{ padding: "10px 14px", background: "#f8f8f8", borderRadius: "6px", marginBottom: "16px", fontSize: "13px", color: "#666" }}>👤 Signing up as: <strong>{profile?.full_name || user?.email}</strong></div>

            {bookingMessage && (<div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", background: bookingMessage.type === 'success' ? "#dcfce7" : "#fee2e2", color: bookingMessage.type === 'success' ? "#166534" : "#991b1b", fontSize: "13px" }}>{bookingMessage.text}</div>)}

            <button type="submit" disabled={isSubmitting} style={{ width: "100%", padding: "14px", borderRadius: "8px", background: isSubmitting ? "#999" : "#ef3a40", color: "white", border: "none", fontSize: "14px", fontWeight: "700", cursor: isSubmitting ? "not-allowed" : "pointer", letterSpacing: "1px", textTransform: "uppercase", boxShadow: "0 4px 14px rgba(239,58,64,0.35)", transition: "all 0.2s" }}>{isSubmitting ? "Signing up..." : "✅ Sign Up for This Event"}</button>
          </form>
        ) : (
          <div style={{ padding: "20px", background: "#dcfce7", borderRadius: "8px", textAlign: "center", color: "#166534", fontWeight: "600", fontSize: "14px" }}>
            ✅ You're already signed up for this event!
            <br />
            <span style={{ fontSize: "12px", fontWeight: "400", color: "#555" }}>Your shift: {getBookingForEvent(event.id)?.selected_slot}</span>
          </div>
        )}
      </div>
    </div>
  );
}
