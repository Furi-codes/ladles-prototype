"use client";
import React from "react";

export default function LoadingScreen({ message }: { message: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: "6px solid rgba(239,58,64,0.15)", borderTopColor: "#ef3a40", margin: "0 auto 18px", animation: "spin 0.9s linear infinite" }} />
        <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#2b3336" }}>{message}</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}
