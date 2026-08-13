"use client";
import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import PageHeader from "./components/PageHeader";

// --- TAB COMPONENTS ---
import DashboardTab from "./components/DashboardTab";
import ActivitiesTab from "./components/ActivitiesTab";
import VolunteerView from "./components/VolunteerTab";

// --- CRUD SERVICE ---
import { getEvents, getBookings, getVolunteers } from "../../lib/admin-actions";

export default function AdminDashboard() {
  // --- UI STATE ---
  const [activeNav, setActiveNav] = useState("Dashboard");

  // --- DATABASE STATE ---
  const [events, setEvents] = useState<any[]>([]); 
  const [bookings, setBookings] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- ENGINE DRIVER ---
  useEffect(() => {
    fetchData();
  }, []); 

  async function fetchData() { 
    setIsLoading(true);
    
    const { data: eData } = await getEvents();
    if (eData) setEvents(eData); 

    const { data: bData } = await getBookings();
    if (bData) setBookings(bData);

    const { data: vData } = await getVolunteers();
    if (vData) setVolunteers(vData);

    setIsLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", fontFamily: "'Montserrat', 'Segoe UI', Roboto, Helvetica, sans-serif" }}>

      {/* SIDEBAR */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      {/* MAIN CONTENT AREA */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Nav Header */}
        <TopHeader activeNav={activeNav} />

        {/* Dynamic Page Body */}
        <main style={{ padding: "32px", flex: 1 }}>
          
          <PageHeader activeNav={activeNav} />

          {/* TAB 1: DASHBOARD */}
          {activeNav === "Dashboard" && (
            <DashboardTab bookings={bookings} events={events} volunteers={volunteers} isLoading={isLoading} />
          )}

          {/* TAB 2: MANAGE ACTIVITIES */}
          {activeNav === "Manage Activities" && (
             <ActivitiesTab events={events} isLoading={isLoading} fetchData={fetchData} />
          )}

          {/* TAB 3: VOLUNTEERS */}
          {activeNav === "Volunteers" && (
            <VolunteerView volunteers={volunteers} />
          )}

          {/* PLACEHOLDERS FOR REMAINING TABS */}
          {["Corporate CSR", "Export Reports", "Settings"].includes(activeNav) && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px dashed #cbd5e1", padding: "60px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🛠️</div>
              <h3 style={{ fontSize: "18px", color: "#1a1a1a", margin: "0 0 8px", fontWeight: "700" }}>{activeNav} Module</h3>
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>This section is currently under construction for the prototype phase.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}