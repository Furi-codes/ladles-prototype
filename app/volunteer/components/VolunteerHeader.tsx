"use client";
import React from "react";
import Image from "next/image";

export default function VolunteerHeader({ profile, user, isAuthenticated, onSignOut, fetchData } : { profile?: any; user?: any; isAuthenticated: boolean; onSignOut: () => void; fetchData?: () => void }) {
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "6px", background: "#ef3a40", zIndex: 100 }} />

      <header style={{
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 32px",
        height: "70px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        marginTop: "6px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden" }}>
            <Image src="/ladles-logo.png" alt="Ladles of Love" width={44} height={44} style={{ objectFit: "contain", width: "100%", height: "100%" }} />
          </div>
          <div>
            <h1 style={{ color: "#2b3336", margin: 0, fontSize: "17px", fontWeight: "800", letterSpacing: "-0.3px" }}>
              LADLES OF LOVE
            </h1>
            <div style={{ fontSize: "11px", color: "#ef3a40", letterSpacing: "1px", textTransform: "uppercase", fontStyle: "italic" }}>
              feeding the soul
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {isAuthenticated && profile && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              background: "#f3f3f3",
              borderRadius: "20px",
              fontSize: "13px",
              color: "#2b3336"
            }}>
              <span>👋</span>
              <span style={{ fontWeight: "600" }}>{profile.full_name}</span>
            </div>
          )}

          <button type="button" onClick={onSignOut} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #ef3a40", background: "#fff", color: "#ef3a40", fontSize: "12px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.5px" }}>
            Sign Out
          </button>
        </div>
      </header>
    </>
  );
}
