"use client";
import React from "react";

export default function LiveStatusBar({ isAuthenticated, profile, user, fetchData } : { isAuthenticated: boolean; profile?: any; user?: any; fetchData: () => void; }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#16a34a", padding: "6px 14px", background: "#dcfce7", borderRadius: "20px" }}>
        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a", animation: "pulse 1.5s infinite" }}></span>
        Live Updates
      </div>
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {isAuthenticated && (
          <span style={{ fontSize: "13px", color: "#2b3336", fontWeight: "600" }}>✅ Logged in as {profile?.full_name || user?.email}</span>
        )}
        <button onClick={fetchData} style={{ padding: "6px 16px", background: "#2b3336", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>🔄 Refresh</button>
      </div>
    </div>
  );
}
