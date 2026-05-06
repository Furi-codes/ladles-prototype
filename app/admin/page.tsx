"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const recentSignups = [
  { name: "Thabo Mokoena", event: "Dignity Kitchen", date: "10 Jun", status: "Verified", hours: 3.0, avatar: "TM", role: "Individual" },
  { name: "Priya Naidoo", event: "Warehouse Packing", date: "10 Jun", status: "Verified", hours: 3.0, avatar: "PN", role: "Individual" },
  { name: "Sara Jacobs", event: "Mandela Day Drive", date: "09 Jun", status: "Pending", hours: 6.0, avatar: "SJ", role: "Corporate" },
  { name: "James Hendricks", event: "Team Build – FNB", date: "09 Jun", status: "Verified", hours: 4.0, avatar: "JH", role: "Corporate" },
  { name: "Ayanda Dlamini", event: "Dignity Kitchen", date: "08 Jun", status: "No-Show", hours: 0, avatar: "AD", role: "Individual" },
  { name: "Chloe Botha", event: "Warehouse Packing", date: "07 Jun", status: "Verified", hours: 3.0, avatar: "CB", role: "Individual" },
  { name: "Sipho Khumalo", event: "Dignity Kitchen", date: "07 Jun", status: "Pending", hours: 3.0, avatar: "SK", role: "School" },
  { name: "Naledi Sithole", event: "Food Parcel Drive", date: "06 Jun", status: "Verified", hours: 5.0, avatar: "NS", role: "Individual" },
];

const activities = [
  { title: "Dignity Kitchen", date: "13 Jun", slots: 24, booked: 16, status: "Open" },
  { title: "Warehouse Packing", date: "14 Jun", slots: 30, booked: 22, status: "Open" },
  { title: "Mandela Day Drive", date: "17 Jul", slots: 100, booked: 97, status: "Almost Full" },
  { title: "Team Build – FNB", date: "21 Jun", slots: 20, booked: 8, status: "Open" },
];

const statusStyle = (s: string): React.CSSProperties => {
  if (s === "Verified") return { background: "#dcfce7", color: "#16a34a" };
  if (s === "Pending") return { background: "#fef9c3", color: "#ca8a04" };
  if (s === "No-Show") return { background: "#fee2e2", color: "#dc2626" };
  return {};
};

const roleStyle = (r: string): React.CSSProperties => {
  if (r === "Corporate") return { background: "#ede9fe", color: "#7c3aed" };
  if (r === "School") return { background: "#dbeafe", color: "#2563eb" };
  return { background: "#fff8f0", color: "#d4780a" };
};

const navLinks = [
  { label: "Dashboard", icon: "📊", active: true },
  { label: "Manage Activities", icon: "📅", active: false },
  { label: "Volunteers", icon: "👥", active: false },
  { label: "Corporate CSR", icon: "🏢", active: false },
  { label: "Export Reports", icon: "📤", active: false },
  { label: "Settings", icon: "⚙️", active: false },
];

const avatarColors = [
  "#ff8c00", "#2563eb", "#7c3aed", "#16a34a",
  "#dc2626", "#0891b2", "#d97706", "#be185d",
];

export default function AdminDashboard() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Dashboard");

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: "#f4f0ea",
      fontFamily: "'Trebuchet MS', sans-serif",
    }}>

      {/* Sidebar */}
      <aside style={{
        width: "240px",
        background: "#2d1200",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid rgba(255,180,80,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>🍲</span>
            <div>
              <div style={{
                fontFamily: "'Georgia', serif",
                color: "#fff8f0",
                fontSize: "15px",
                fontWeight: "700",
                lineHeight: 1.1,
              }}>
                Ladles of Love
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,180,80,0.6)", letterSpacing: "1px", textTransform: "uppercase" }}>
                Admin Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navLinks.map((link) => {
            const isActive = activeNav === link.label;
            return (
              <button
                key={link.label}
                onClick={() => setActiveNav(link.label)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: isActive ? "rgba(255,140,0,0.18)" : "transparent",
                  color: isActive ? "#ffb347" : "rgba(255,220,160,0.65)",
                  fontSize: "13px",
                  fontWeight: isActive ? "700" : "500",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: "4px",
                  transition: "background 0.15s, color 0.15s",
                  borderLeft: isActive ? "3px solid #ff8c00" : "3px solid transparent",
                }}
                onMouseOver={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseOut={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span>{link.icon}</span>
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Card */}
        <div style={{
          padding: "16px",
          borderTop: "1px solid rgba(255,180,80,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          <div style={{
            width: "36px", height: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ff8c00, #ffb347)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
            fontWeight: "700",
            fontSize: "13px",
            flexShrink: 0,
          }}>
            JJ
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#fff8f0", fontWeight: "600" }}>Joe Johnson</div>
            <div style={{ fontSize: "10px", color: "rgba(255,180,80,0.6)" }}>Operations Lead</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Top Nav */}
        <header style={{
          background: "#fff",
          borderBottom: "1px solid #ede4d4",
          padding: "0 32px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
        }}>
          <div>
            <span style={{ fontSize: "13px", color: "#b09070" }}>Admin Dashboard</span>
            <span style={{ fontSize: "13px", color: "#ddd", margin: "0 8px" }}>·</span>
            <span style={{ fontSize: "13px", color: "#5c3a1a", fontWeight: "600" }}>June 2025</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => router.push("/volunteer")}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: "1.5px solid #e8d5b5",
                background: "#fff8f0",
                color: "#d4780a",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              ← Switch to Volunteer View
            </button>
            <div style={{
              padding: "5px 12px",
              borderRadius: "20px",
              background: "#fff8f0",
              border: "1px solid #f0e4d0",
              fontSize: "12px",
              color: "#8c6a40",
            }}>
              🟢 Live
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main style={{ padding: "32px", flex: 1 }}>

          {/* Page Title */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{
              fontFamily: "'Georgia', serif",
              fontSize: "26px",
              color: "#2d1200",
              margin: 0,
              fontWeight: "700",
            }}>
              Operations Dashboard
            </h1>
            <p style={{ color: "#8c6a40", fontSize: "13px", margin: "4px 0 0" }}>
              Cape Town & Johannesburg · Real-time overview
            </p>
          </div>

          {/* Stats Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}>
            {[
              { label: "Total Volunteers", value: "1,204", icon: "👥", change: "+48 this month", up: true },
              { label: "Hours This Week", value: "340", icon: "⏱️", change: "+12% vs last week", up: true },
              { label: "Active Bookings", value: "143", icon: "📋", change: "Across 4 events", up: null },
              { label: "Corporate Partners", value: "27", icon: "🏢", change: "+3 new this quarter", up: true },
              { label: "No-Shows Today", value: "5", icon: "⚠️", change: "−2 vs yesterday", up: false },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: "#fff",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #ede4d4",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: "22px", marginBottom: "8px" }}>{stat.icon}</div>
                <div style={{
                  fontFamily: "'Georgia', serif",
                  fontSize: "26px",
                  fontWeight: "700",
                  color: "#2d1200",
                  lineHeight: 1,
                  marginBottom: "4px",
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "12px", color: "#5c3a1a", fontWeight: "600", marginBottom: "2px" }}>
                  {stat.label}
                </div>
                <div style={{
                  fontSize: "11px",
                  color: stat.up === true ? "#16a34a" : stat.up === false ? "#dc2626" : "#8c6a40",
                  fontWeight: "600",
                }}>
                  {stat.up === true ? "▲ " : stat.up === false ? "▼ " : ""}{stat.change}
                </div>
              </div>
            ))}
          </div>

          {/* Two-column lower section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>

            {/* Bookings Table */}
            <div style={{
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid #ede4d4",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid #f0e4d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <h3 style={{
                  fontFamily: "'Georgia', serif",
                  fontSize: "17px",
                  color: "#2d1200",
                  margin: 0,
                  fontWeight: "700",
                }}>
                  Recent Sign-ups
                </h3>
                <button style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid #e8d5b5",
                  background: "#fff8f0",
                  color: "#d4780a",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}>
                  Export CSV ↓
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fdf8f2" }}>
                    {["Volunteer", "Event", "Date", "Type", "Status", "Hours"].map((col) => (
                      <th key={col} style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#8c6a40",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        borderBottom: "1px solid #f0e4d0",
                        whiteSpace: "nowrap",
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSignups.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: i < recentSignups.length - 1 ? "1px solid #f8f2ea" : "none",
                      transition: "background 0.1s",
                    }}
                      onMouseOver={e => (e.currentTarget as HTMLTableRowElement).style.background = "#fdf9f5"}
                      onMouseOut={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px", height: "32px",
                            borderRadius: "50%",
                            background: avatarColors[i % avatarColors.length],
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff",
                            fontSize: "11px",
                            fontWeight: "700",
                            flexShrink: 0,
                          }}>
                            {row.avatar}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#2d1200", whiteSpace: "nowrap" }}>
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#5c3a1a", whiteSpace: "nowrap" }}>
                        {row.event}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#b09070", whiteSpace: "nowrap" }}>
                        {row.date}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: "10px",
                          padding: "3px 8px",
                          borderRadius: "20px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          whiteSpace: "nowrap",
                          ...roleStyle(row.role),
                        }}>
                          {row.role}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "20px",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          ...statusStyle(row.status),
                        }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{
                        padding: "12px 16px",
                        fontSize: "13px",
                        fontWeight: "700",
                        color: row.hours > 0 ? "#d4780a" : "#dc2626",
                        whiteSpace: "nowrap",
                      }}>
                        {row.hours > 0 ? `${row.hours}h` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Activity Capacity Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              <div style={{
                background: "#fff",
                borderRadius: "16px",
                border: "1px solid #ede4d4",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                padding: "20px",
              }}>
                <h3 style={{
                  fontFamily: "'Georgia', serif",
                  fontSize: "16px",
                  color: "#2d1200",
                  margin: "0 0 16px",
                  fontWeight: "700",
                }}>
                  Activity Capacity
                </h3>
                {activities.map((act, i) => {
                  const pct = Math.round((act.booked / act.slots) * 100);
                  const barColor = pct >= 90 ? "#dc2626" : pct >= 70 ? "#d4780a" : "#16a34a";
                  return (
                    <div key={i} style={{ marginBottom: i < activities.length - 1 ? "18px" : 0 }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#2d1200" }}>{act.title}</div>
                          <div style={{ fontSize: "11px", color: "#b09070" }}>{act.date}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: barColor }}>{pct}%</div>
                          <div style={{ fontSize: "11px", color: "#b09070" }}>{act.booked}/{act.slots}</div>
                        </div>
                      </div>
                      <div style={{
                        height: "6px",
                        borderRadius: "4px",
                        background: "#f0e4d0",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: "4px",
                          background: barColor,
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div style={{
                background: "linear-gradient(135deg, #2d1200, #7c3300)",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}>
                <h4 style={{
                  fontFamily: "'Georgia', serif",
                  color: "#fff",
                  fontSize: "15px",
                  margin: "0 0 14px",
                  fontWeight: "700",
                }}>
                  Quick Actions
                </h4>
                {[
                  "➕ Create New Activity",
                  "📤 Export Monthly Report",
                  "📧 Notify All Volunteers",
                  "🏢 Add Corporate Group",
                ].map((action) => (
                  <button
                    key={action}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,180,80,0.25)",
                      background: "rgba(255,255,255,0.07)",
                      color: "rgba(255,240,200,0.9)",
                      fontSize: "12px",
                      fontWeight: "600",
                      textAlign: "left",
                      cursor: "pointer",
                      marginBottom: "8px",
                      transition: "background 0.15s",
                    }}
                    onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,140,0,0.2)"}
                    onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"}
                  >
                    {action}
                  </button>
                ))}
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}