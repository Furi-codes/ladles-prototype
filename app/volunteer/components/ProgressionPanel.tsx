"use client";
import React from "react";
import moment from "moment";
import type { Booking } from "@/lib/types";

export default function ProgressionPanel({
  bookings,
  user,
  getEventData,
  printMyProgression,
}: {
  bookings: Booking[];
  user?: any;
  getEventData: (eventId: number) => any;
  printMyProgression: () => void;
}) {
  const completed = bookings.filter(b => b.status === "Completed" && b.user_id === user?.id);

  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: "18px", color: "#2b3336", margin: 0, fontWeight: "800" }}>My Progression</h3>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f3f3f3" }}>
            <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#2b3336", textTransform: "uppercase", letterSpacing: "1px" }}>Progress</th>
            <th style={{ padding: "12px 24px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#2b3336", textTransform: "uppercase", letterSpacing: "1px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #f3f3f3" }}>
            <td style={{ padding: "16px 24px", fontSize: "13px", fontWeight: "600" }}>Hours Volunteered</td>
            <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "13px", fontWeight: "700", color: "#ef3a40" }}>{completed.reduce((total) => total + 2, 0)} hours</td>
          </tr>
          <tr>
            <td style={{ padding: "16px 24px", fontSize: "13px", fontWeight: "600" }}>Events Completed</td>
            <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "13px", fontWeight: "700", color: "#ef3a40" }}>{completed.length}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ padding: "12px 24px", borderTop: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={printMyProgression} style={{ padding: "8px 18px", background: "#fff", color: "#2b3336", border: "1px solid #2b3336", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2b3336"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "#2b3336"; }}
        >
          🖨️ Print My Progression
        </button>

        <span style={{ fontSize: "11px", color: "#999" }}>{completed.length} events completed</span>
      </div>
    </div>
  );
}
