"use client";

export default function PageHeader({ activeNav }: { activeNav: string }) {
    return (
        <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontFamily: "'montserrat-black', 'Montserrat', sans-serif", fontSize: "42px", fontWeight: 900, margin: 0, letterSpacing: "-0.5px" }}>
              {activeNav === "Dashboard" && (
                <><span style={{ color: "transparent", WebkitTextStroke: "1.5px #262626" }}>More ways </span><span style={{ color: "#262626" }}>to get involved</span></>
              )}
              {activeNav === "Manage Activities" && <span style={{ color: "#262626" }}>Manage Activities</span>}
              {activeNav === "Volunteers" && <span style={{ color: "#262626" }}>Volunteer Directory</span>}
              {["Corporate CSR", "Export Reports", "Settings"].includes(activeNav) && <span style={{ color: "#262626" }}>{activeNav}</span>}
            </h2>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0" }}>Cape Town & Johannesburg · Real-time overview</p>
          </div>
    );
}