"use client";
import React from "react";
import type { Booking, Event } from "@/lib/types";

export default function ActiveShifts({
  userBookings,
  isAuthenticated,
  isLoading,
  cancelBooking,
  getEventData,
}: {
  userBookings: Booking[];
  isAuthenticated: boolean;
  isLoading: boolean;
  cancelBooking: (id: number) => void;
  getEventData: (eventId: number) => Event | undefined | null;
}) {
  return (
    <div>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 24px", border: "1px solid #e0e0e0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "18px", color: "#2b3336", margin: 0, fontWeight: "800" }}>My Active Shifts</h3>
          <span style={{ fontSize: "12px", color: "#fff", fontWeight: "700", background: "#ef3a40", padding: "4px 12px", borderRadius: "20px" }}>{userBookings.length}</span>
        </div>

        {!isAuthenticated ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#999", fontSize: "14px" }}>🔒 Please log in to see your shifts</div>
        ) : isLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#666", fontSize: "14px" }}>Loading your shifts...</div>
        ) : userBookings.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#999", fontSize: "14px" }}>You have no active shifts.<br /><span style={{ fontSize: "12px", color: "#ccc" }}>Click on an event in the calendar to sign up!</span></div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {userBookings.map((booking) => {
              const eventInfo = getEventData(booking.event_id);
              return (
                <div key={booking.id} style={{ padding: "16px 24px", borderBottom: "1px solid #f3f3f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#2b3336", marginBottom: "4px" }}>{eventInfo?.title || "Unknown Event"}</div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>📍 {eventInfo?.location || "N/A"} &nbsp;|&nbsp; 📅 {eventInfo?.date || "N/A"}</div>
                    <div style={{ fontSize: "11px", color: "#2b3336", background: "#f3f3f3", display: "inline-block", padding: "3px 8px", borderRadius: "4px", fontWeight: "600" }}>⏱️ {booking.selected_slot}</div>
                  </div>
                  <button onClick={() => cancelBooking(booking.id)} style={{ padding: "6px 14px", background: "#ef3a40", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
