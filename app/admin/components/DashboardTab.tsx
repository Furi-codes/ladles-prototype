"use client";

export default function DashboardTab({ bookings, events, volunteers, isLoading }: { bookings: any[], events: any[], volunteers: any[], isLoading: boolean }) {
  
  function getEventName(eventId: number) {
    const evt = events.find((e: any) => e.id === eventId);
    return evt ? evt.title : "Unknown Event";
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "Total Bookings", value: bookings.length.toString(), icon: "👥", change: "Live Sync", up: true },
          { label: "Active Events", value: events.length.toString(), icon: "📋", change: "In database", up: true },
          { label: "Registered Volunteers", value: volunteers.length.toString(), icon: "❤️", change: "Community", up: true },
          { label: "System Status", value: isLoading ? "Syncing" : "Ready", icon: "⚡", change: "Supabase connected", up: true },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "22px", marginBottom: "8px" }}>{stat.icon}</div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: "#1a1a1a", lineHeight: 1, marginBottom: "4px" }}>{stat.value}</div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", marginBottom: "2px" }}>{stat.label}</div>
            <div style={{ fontSize: "11px", color: stat.up ? "#16a34a" : "#64748b", fontWeight: "700" }}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: "16px", color: "#1a1a1a", margin: 0, fontWeight: "700" }}>Live Bookings Feed</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Volunteer", "Event", "Slot", "Status"].map((col) => (
                <th key={col} style={{ padding: "12px 24px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.slice(0, 5).map((row: any, index: number) => (
              <tr key={row.id} style={{ borderBottom: index < 4 ? "1px solid #f1f5f9" : "none" }}>
                <td style={{ padding: "14px 24px", fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{row.volunteer_name}</td>
                <td style={{ padding: "14px 24px", fontSize: "13px", color: "#475569" }}>{getEventName(row.event_id)}</td>
                <td style={{ padding: "14px 24px", fontSize: "12px", color: "#64748b" }}>{row.selected_slot}</td>
                <td style={{ padding: "14px 24px" }}>
                  <span style={{ padding: "4px 8px", background: "#dcfce7", color: "#16a34a", borderRadius: "4px", fontSize: "11px", fontWeight: "700" }}>Confirmed</span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No recent bookings.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}