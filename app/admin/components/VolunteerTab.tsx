"use client";

export default function VolunteerView({volunteers}: {volunteers: any[]}) {
    return (
             <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Registered Users</h3>
                <input placeholder="Search volunteers..." style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }} />
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Name", "Email Address", "Role", "Actions"].map((col) => (
                      <th key={col} style={{ padding: "12px 24px", textAlign: col === "Actions" ? "right" : "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {volunteers.map((vol, index) => (
                    <tr key={vol.id} style={{ borderBottom: index < volunteers.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "14px 24px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{vol.full_name || "N/A"}</td>
                      <td style={{ padding: "14px 24px", fontSize: "13px", color: "#475569" }}>{vol.email || "N/A"}</td>
                      <td style={{ padding: "14px 24px", fontSize: "12px" }}>
                        <span style={{ padding: "4px 8px", background: vol.role === "admin" ? "#fef2f2" : "#f1f5f9", color: vol.role === "admin" ? "#e62b32" : "#475569", borderRadius: "4px", fontWeight: "700" }}>
                          {vol.role || "volunteer"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 24px", textAlign: "right" }}>
                        <button style={{ background: "transparent", color: "#64748b", border: "1px solid #cbd5e1", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>View Profile</button>
                      </td>
                    </tr>
                  ))}
                  {volunteers.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No volunteers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
    );
}