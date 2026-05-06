"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const activities = [
  {
    id: 1,
    title: "Dignity Kitchen",
    location: "Salt River, Cape Town",
    date: "Friday, 13 June 2025",
    time: "09:00 – 12:00",
    spots: 8,
    category: "Meal Prep",
    emoji: "🍲",
  },
  {
    id: 2,
    title: "Warehouse Packing",
    location: "Epping Industria, Cape Town",
    date: "Saturday, 14 June 2025",
    time: "08:00 – 11:00",
    spots: 14,
    category: "Logistics",
    emoji: "📦",
  },
  {
    id: 3,
    title: "Mandela Day Drive",
    location: "Khayelitsha Community Centre",
    date: "Thursday, 17 July 2025",
    time: "07:30 – 13:30",
    spots: 3,
    category: "Community",
    emoji: "🤝",
  },
  {
    id: 4,
    title: "Team Build – Corporate",
    location: "Woodstock, Cape Town",
    date: "Saturday, 21 June 2025",
    time: "10:00 – 14:00",
    spots: 20,
    category: "Team Build",
    emoji: "🏗️",
  },
];

const history = [
  { event: "Dignity Kitchen", date: "2 May 2025", hours: 3.0, status: "Verified" },
  { event: "Warehouse Packing", date: "18 Apr 2025", hours: 3.0, status: "Verified" },
  { event: "Food Parcel Drive", date: "5 Apr 2025", hours: 6.5, status: "Verified" },
];

const categoryColors: Record<string, string> = {
  "Meal Prep": "#ff8c00",
  Logistics: "#2563eb",
  Community: "#16a34a",
  "Team Build": "#7c3aed",
};

export default function VolunteerDashboard() {
  const router = useRouter();
  const [booked, setBooked] = useState<number[]>([]);

  const handleBook = (id: number) => {
    if (booked.includes(id)) return;
    setBooked((prev) => [...prev, id]);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8f4ee",
      fontFamily: "'Trebuchet MS', sans-serif",
    }}>

      {/* Top Nav */}
      <nav style={{
        background: "#2d1200",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "60px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🍲</span>
          <span style={{
            fontFamily: "'Georgia', serif",
            color: "#fff8f0",
            fontSize: "18px",
            fontWeight: "700",
          }}>
            Ladles of Love
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            onClick={() => router.push("/admin")}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1.5px solid rgba(255,180,80,0.5)",
              background: "transparent",
              color: "#ffb347",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseOver={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,140,0,0.15)"}
            onMouseOut={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
          >
            Switch to Admin View →
          </button>

          <div style={{
            width: "36px", height: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ff8c00, #ffb347)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
            fontWeight: "700",
            fontSize: "14px",
          }}>
            SA
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "36px 24px" }}>

        {/* Greeting */}
        <div style={{ marginBottom: "32px" }}>
          <p style={{ color: "#8c6a40", fontSize: "13px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "1px" }}>
            Welcome back 👋
          </p>
          <h1 style={{
            fontFamily: "'Georgia', serif",
            fontSize: "30px",
            color: "#2d1200",
            margin: 0,
            fontWeight: "700",
          }}>
            Sarah Anderson
          </h1>
        </div>

        {/* Stats Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "40px",
        }}>
          {[
            { label: "Hours Logged", value: "12.5", icon: "⏱️", sub: "This year" },
            { label: "Shifts Completed", value: "3", icon: "✅", sub: "All verified" },
            { label: "Next Shift", value: "3 days", icon: "📅", sub: "Dignity Kitchen" },
            { label: "Impact Score", value: "94", icon: "⭐", sub: "Top 10% volunteer" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "22px 20px",
              border: "1px solid #f0e4d0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>{stat.icon}</div>
              <div style={{
                fontFamily: "'Georgia', serif",
                fontSize: "28px",
                fontWeight: "700",
                color: "#2d1200",
                lineHeight: 1,
                marginBottom: "4px",
              }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "13px", color: "#5c3a1a", fontWeight: "600" }}>{stat.label}</div>
              <div style={{ fontSize: "11px", color: "#b09070", marginTop: "2px" }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "28px" }}>

          {/* Upcoming Opportunities */}
          <div>
            <h2 style={{
              fontFamily: "'Georgia', serif",
              fontSize: "20px",
              color: "#2d1200",
              marginBottom: "16px",
              fontWeight: "700",
            }}>
              Upcoming Opportunities
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {activities.map((act) => {
                const isBooked = booked.includes(act.id);
                const isLow = act.spots <= 5;
                return (
                  <div key={act.id} style={{
                    background: "#fff",
                    borderRadius: "16px",
                    padding: "20px 24px",
                    border: `1px solid ${isBooked ? "#d4f0d4" : "#f0e4d0"}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    transition: "transform 0.15s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
                      <div style={{
                        width: "52px", height: "52px",
                        borderRadius: "12px",
                        background: "#fff8f0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "24px",
                        flexShrink: 0,
                        border: "1px solid #f0e4d0",
                      }}>
                        {act.emoji}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{
                            fontFamily: "'Georgia', serif",
                            fontSize: "16px",
                            fontWeight: "700",
                            color: "#2d1200",
                          }}>
                            {act.title}
                          </span>
                          <span style={{
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "20px",
                            background: categoryColors[act.category] + "18",
                            color: categoryColors[act.category],
                            fontWeight: "700",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}>
                            {act.category}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#8c6a40", marginBottom: "2px" }}>
                          📍 {act.location}
                        </div>
                        <div style={{ fontSize: "12px", color: "#8c6a40" }}>
                          🗓️ {act.date} &nbsp;·&nbsp; 🕘 {act.time}
                        </div>
                        <div style={{
                          fontSize: "11px",
                          color: isLow ? "#dc2626" : "#16a34a",
                          fontWeight: "600",
                          marginTop: "4px",
                        }}>
                          {isLow ? `⚠️ Only ${act.spots} spots left!` : `✓ ${act.spots} spots available`}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBook(act.id)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        background: isBooked
                          ? "linear-gradient(135deg, #16a34a, #22c55e)"
                          : "linear-gradient(135deg, #d4780a, #ff8c00)",
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: isBooked ? "default" : "pointer",
                        flexShrink: 0,
                        boxShadow: isBooked
                          ? "0 2px 8px rgba(22,163,74,0.35)"
                          : "0 2px 8px rgba(212,120,10,0.35)",
                        transition: "transform 0.1s",
                        minWidth: "100px",
                        textAlign: "center",
                      }}
                      onMouseOver={e => {
                        if (!isBooked) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)";
                      }}
                      onMouseOut={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                      }}
                    >
                      {isBooked ? "✓ Booked" : "Book Shift"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Volunteer History */}
            <div style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "22px",
              border: "1px solid #f0e4d0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <h3 style={{
                fontFamily: "'Georgia', serif",
                fontSize: "16px",
                color: "#2d1200",
                margin: "0 0 16px",
                fontWeight: "700",
              }}>
                My History
              </h3>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                  borderBottom: i < history.length - 1 ? "1px solid #f5ede0" : "none",
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#2d1200" }}>{h.event}</div>
                    <div style={{ fontSize: "11px", color: "#b09070" }}>{h.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#d4780a" }}>{h.hours}h</div>
                    <div style={{ fontSize: "10px", color: "#16a34a", fontWeight: "600" }}>✓ {h.status}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Certificate Card */}
            <div style={{
              background: "linear-gradient(135deg, #2d1200, #7c3300)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: "-30px", right: "-30px",
                width: "120px", height: "120px", borderRadius: "50%",
                background: "rgba(255,140,0,0.15)",
              }} />
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>🏅</div>
              <h4 style={{
                fontFamily: "'Georgia', serif",
                color: "#fff",
                fontSize: "15px",
                margin: "0 0 6px",
                fontWeight: "700",
              }}>
                Volunteer Certificate
              </h4>
              <p style={{ fontSize: "12px", color: "rgba(255,220,160,0.75)", margin: "0 0 16px" }}>
                12.5 hours logged · 3 events completed
              </p>
              <button style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1.5px solid rgba(255,180,80,0.6)",
                background: "transparent",
                color: "#ffb347",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                letterSpacing: "0.5px",
              }}>
                Download PDF →
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}