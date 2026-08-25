"use client";
import React from "react";

export default function WelcomeCard({ isLoadingUser, isAuthenticated, profile, userBookingsCount, eventsCount } : { isLoadingUser: boolean; isAuthenticated: boolean; profile?: any; userBookingsCount: number; eventsCount: number; }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 24px", marginBottom: "32px", border: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
      <div>
        {isLoadingUser ? (
          <span style={{ fontSize: "14px", color: "#666" }}>Loading your profile...</span>
        ) : isAuthenticated ? (
          <span style={{ fontSize: "14px", color: "#2b3336" }}>👋 Welcome back, <strong>{profile?.full_name || ""}</strong>! You have <strong style={{ color: "#ef3a40" }}>{userBookingsCount}</strong> active shift{userBookingsCount !== 1 ? 's' : ''}.</span>
        ) : (
          <span style={{ fontSize: "14px", color: "#ef3a40" }}>⚠️ Please log in to sign up for events.</span>
        )}
      </div>
      <div style={{ fontSize: "12px", color: "#666", background: "#f3f3f3", padding: "4px 12px", borderRadius: "12px" }}>📅 {eventsCount} events available</div>
    </div>
  );
}
