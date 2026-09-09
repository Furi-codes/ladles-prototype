"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type AdminNav } from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import PageHeader from "./components/PageHeader";
import styles from "./admin.module.css";
import type { Event, Booking, Volunteer } from "../../lib/types";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole } from "@/lib/actions/profile";
import DashboardTab from "./components/DashboardTab";
import ActivitiesTab from "./components/ActivitiesTab";
import VolunteerView from "./components/VolunteerTab";
import { fetchAdminBookings, fetchAdminEvents, fetchVolunteers } from "@/lib/actions/admin";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<AdminNav>("Dashboard"); const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]); const [bookings, setBookings] = useState<Booking[]>([]); const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isLoading, setIsLoading] = useState(true); const [isCheckingAccess, setIsCheckingAccess] = useState(true); const [loadError, setLoadError] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<{ full_name?: string; email?: string }>({});

  async function handleSignOut() { await supabase.auth.signOut(); router.replace("/"); }

  useEffect(() => { async function guardAdminAccess() { const user = await getCurrentUser(); if (!user) { router.replace("/"); return; } const { data: profile, error } = await fetchUserRole(user.id); if (error || !profile || profile.role !== "admin") { router.replace("/volunteer"); return; } setAdminProfile({ full_name: profile.full_name, email: profile.email }); setIsCheckingAccess(false); } void guardAdminAccess(); }, [router]);

  const fetchData = useCallback(async () => { setIsLoading(true); setLoadError(null); try { const [eventsResult, bookingsResult, volunteersResult] = await Promise.all([fetchAdminEvents(), fetchAdminBookings(), fetchVolunteers()]); if (eventsResult.error || bookingsResult.error || volunteersResult.error) throw eventsResult.error ?? bookingsResult.error ?? volunteersResult.error; setEvents(eventsResult.data ?? []); setBookings(bookingsResult.data ?? []); setVolunteers(volunteersResult.data ?? []); } catch (error) { console.error("Failed to load admin data:", error); setLoadError("Admin data could not be loaded. Please try again."); } finally { setIsLoading(false); } }, []);

  useEffect(() => { if (isCheckingAccess) return; let active = true; queueMicrotask(() => { if (active) void fetchData(); }); const bookingSubscription = supabase.channel("admin-bookings").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void fetchData()).subscribe(); const eventSubscription = supabase.channel("admin-events").on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void fetchData()).subscribe(); return () => { active = false; void bookingSubscription.unsubscribe(); void eventSubscription.unsubscribe(); }; }, [fetchData, isCheckingAccess]);

  if (isCheckingAccess) return <main className={styles.shell}><div className={styles.empty}>Checking administrator access...</div></main>;
  const isPlaceholder = activeNav === "Corporate CSR" || activeNav === "Export Reports" || activeNav === "Settings";
  return <div className={styles.shell}><Sidebar activeNav={activeNav} setActiveNav={setActiveNav} name={adminProfile.full_name || "Administrator"} email={adminProfile.email} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} /><div className={styles.main}><TopHeader activeNav={activeNav} onSignOut={handleSignOut} adminName={adminProfile.full_name} onMenu={() => setMobileNavOpen(true)} /><main className={styles.content}><PageHeader activeNav={activeNav} />{loadError && <div className={styles.error} role="alert">{loadError}</div>}{activeNav === "Dashboard" && <DashboardTab bookings={bookings} events={events} volunteers={volunteers} isLoading={isLoading} hasError={Boolean(loadError)} />}{activeNav === "Manage Events" && <ActivitiesTab events={events} isLoading={isLoading} fetchData={fetchData} />}{activeNav === "Volunteers" && <VolunteerView events={events} bookings={bookings} />}{isPlaceholder && <section className={`${styles.card} ${styles.placeholder}`}><h2 className={styles.placeholderTitle}>{activeNav}</h2><p className={styles.placeholderText}>This administration section is reserved for a future update. The current dashboard, events, and volunteer workflows remain available.</p></section>}</main></div></div>;
}
