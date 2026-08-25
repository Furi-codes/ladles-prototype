"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import PageHeader from "./components/PageHeader";
import { Event, Booking, Volunteer } from "../../lib/types";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole } from "@/lib/actions/profile";

// --- TAB COMPONENTS ---
import DashboardTab from "./components/DashboardTab";
import ActivitiesTab from "./components/ActivitiesTab";
import VolunteerView from "./components/VolunteerTab";

// --- CRUD ---
import { fetchAdminBookings, fetchAdminEvents, fetchVolunteers } from "@/lib/actions/admin";

export default function AdminDashboard() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  // --- UI STATE ---
  const [activeNav, setActiveNav] = useState("Dashboard"); // Remembers what tab is selected

  // --- DATABASE STATE ---
  const [events, setEvents] = useState<Event[]>([]);             //
  const [bookings, setBookings] = useState<Booking[]>([]);       // Empty because it fills up with data from database
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]); //
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  // --- AUTH GUARD ---
  useEffect(() => {
    async function guardAdminAccess() {
      setIsCheckingAccess(true);

      const user = await getCurrentUser();

      if (!user) {
        router.replace('/');
        return;
      }

      const { data: profile, error } = await fetchUserRole(user.id);

      if (error || !profile || profile.role !== 'admin') {
        router.replace('/volunteer');
        return;
      }

      setIsCheckingAccess(false);
    }

    guardAdminAccess();
  }, [router]);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchData();

    // Subscribe to booking changes
    const subscription = supabase
      .channel('admin-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('📊 Admin: Booking changed:', payload);
          fetchData();
        }
      )
      .subscribe();

    // Also subscribe to event changes
    const eventSubscription = supabase
      .channel('admin-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          console.log('📊 Admin: Event changed:', payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      eventSubscription.unsubscribe();
    };
  }, []);

  async function fetchData() { // async so that it doesnt have to wait for database to do anything else
    setIsLoading(true);
    
    const { data: eData } = await fetchAdminEvents();
    if (eData) setEvents(eData); // If the data is there, set it

    const { data: bData } = await fetchAdminBookings();
    if (bData) setBookings(bData);

    const { data: vData } = await fetchVolunteers();
    if (vData) setVolunteers(vData);

    setIsLoading(false);
  }

  if (isCheckingAccess) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: "6px solid rgba(239,58,64,0.15)", borderTopColor: "#ef3a40", margin: "0 auto 18px", animation: "spin 0.9s linear infinite" }} />
          <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#2b3336" }}>Checking admin access</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc", fontFamily: "'Montserrat', 'Segoe UI', Roboto, Helvetica, sans-serif" }}>

      {/* SIDEBAR */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      {/* MAIN CONTENT AREA */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Nav Header */}
        <TopHeader activeNav={activeNav} onSignOut={handleSignOut} />

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
            <VolunteerView volunteers={volunteers} events={events} bookings={bookings} />
          )}

          {/* PLACEHOLDERS FOR REMAINING TABS */}
          {["Corporate CSR", "Export Reports", "Settings"].includes(activeNav) && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px dashed #cbd5e1", padding: "60px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🛠️</div>
              <h3 style={{ fontSize: "18px", color: "#1a1a1a", margin: "0 0 8px", fontWeight: "700" }}>{activeNav} Module</h3>
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>This section is currently under construction for now. Stay Tuned! :)</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
