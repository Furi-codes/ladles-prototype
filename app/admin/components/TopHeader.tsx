"use client";

export default function TopHeader({ activeNav, onSignOut }: { activeNav: string; onSignOut?: () => void }) {
    return (
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Admin Dashboard</span>
            <span style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>{activeNav}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ padding: "5px 12px", borderRadius: "20px", background: "#1a1a1a", border: "1px solid #333", fontSize: "12px", color: "#ffffff", fontWeight: "600" }}>🔴 Online</div>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #ef3a40",
                  background: "#fff",
                  color: "#ef3a40",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  letterSpacing: "0.5px"
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        </header>
    );
}