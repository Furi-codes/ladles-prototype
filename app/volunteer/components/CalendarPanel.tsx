"use client";
import React from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import type { Event } from "@/lib/types";

export default function CalendarPanel({
  isLoading,
  tileClassName,
  tileContent,
  onDayClick,
}: {
  isLoading: boolean;
  tileClassName: ({ date }: { date: Date }) => string | null;
  tileContent: ({ date }: { date: Date }) => React.ReactNode;
  onDayClick: (date: Date) => void;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", padding: "24px", overflow: "hidden" }}>
      <h2 style={{ fontSize: "20px", color: "#2b3336", margin: "0 0 20px", fontWeight: "800" }}>📅 Event Calendar</h2>
      <p style={{ color: "#666", fontSize: "13px", margin: "0 0 20px", lineHeight: "1.5" }}>Click on any highlighted date to see available events and sign up.</p>

      {isLoading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Loading calendar...</div>
      ) : (
        <div className="calendar-wrapper">
          <Calendar
            onChange={() => {}}
            value={new Date()}
            tileClassName={tileClassName}
            tileContent={tileContent}
            minDate={new Date()}
            locale="en-US"
            onClickDay={onDayClick}
          />
        </div>
      )}

      {/* LEGEND */}
      <div style={{ marginTop: "20px", padding: "12px 16px", background: "#f8f8f8", borderRadius: "6px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "#ef3a40" }}></span>
          Events available
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
          <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "#2b3336" }}></span>
          You're signed up
        </div>
      </div>
    </div>
  );
}
