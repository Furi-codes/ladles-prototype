"use client";
import React from "react";
import moment from "moment";
import type { Event } from "@/lib/types";

export default function EventListModal({
  events,
  onClose,
  onEventClick,
  isUserBookedForEvent,
  isAuthenticated,
}: {
  events: Event[];
  onClose: () => void;
  onEventClick: (event: Event) => void;
  isUserBookedForEvent: (eventId: number) => boolean;
  isAuthenticated: boolean;
}) {
  if (!events || events.length === 0) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "550px", width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "slideUp 0.3s ease-out" }}>
        <button onClick={onClose} style={{ float: "right", background: "none", border: "none", fontSize: "28px", color: "#999", cursor: "pointer", padding: "0 4px" }}>×</button>

        <h2 style={{ fontSize: "22px", color: "#2b3336", margin: "0 0 8px", fontWeight: "800" }}>
          📅 Events on {moment(events[0]?.date).format("MMMM D, YYYY")}
        </h2>
        <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px" }}>{events.length} events available. Click one to sign up.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {events.map((event) => {
            const isBooked = isUserBookedForEvent(event.id);
            return (
              <div key={event.id} style={{ padding: "16px 20px", borderRadius: "10px", border: "1.5px solid #e0e0e0", background: "#fafafa", cursor: isBooked ? "default" : "pointer", transition: "all 0.2s", opacity: isBooked ? 0.6 : 1 }}
                onClick={() => {
                  if (!isBooked && isAuthenticated) {
                    onEventClick(event);
                  } else if (!isAuthenticated) {
                    // keep behavior to be handled by parent
                    onEventClick(event);
                  }
                }}
                onMouseOver={e => { if (!isBooked && isAuthenticated) { (e.currentTarget as HTMLDivElement).style.background = "#f3f3f3"; (e.currentTarget as HTMLDivElement).style.borderColor = "#ef3a40"; } }}
                onMouseOut={e => { if (!isBooked && isAuthenticated) { (e.currentTarget as HTMLDivElement).style.background = "#fafafa"; (e.currentTarget as HTMLDivElement).style.borderColor = "#e0e0e0"; } }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: isBooked ? "#999" : "#2b3336", marginBottom: "4px" }}>
                      {event.title}
                      {isBooked && (
                        <span style={{ fontSize: "11px", color: "#16a34a", background: "#dcfce7", padding: "2px 10px", borderRadius: "12px", marginLeft: "10px", fontWeight: "600" }}>✅ Signed up</span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>📍 {event.location}</div>
                    <div style={{ fontSize: "12px", color: "#888" }}>⏱️ {event.time_slots} · 👥 {event.total_slots} spots</div>
                  </div>

                  {!isBooked && isAuthenticated && (
                    <div style={{ padding: "6px 14px", background: "#ef3a40", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>Sign Up →</div>
                  )}

                  {!isAuthenticated && (
                    <div style={{ padding: "6px 14px", background: "#999", color: "#fff", borderRadius: "6px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>🔒 Login</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "20px", padding: "12px 16px", background: "#f8f8f8", borderRadius: "8px", fontSize: "12px", color: "#666", textAlign: "center" }}>💡 Click any event above to sign up for a time slot</div>
      </div>
    </div>
  );
}
