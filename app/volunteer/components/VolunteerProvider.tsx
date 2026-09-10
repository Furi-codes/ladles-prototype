"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole } from "@/lib/actions/profile";
import { cancelUserBooking, createBooking, ensureUserProfile, fetchBookingsForVolunteer, fetchEventsForVolunteer } from "@/lib/actions/volunteer";
import type { Booking, Event, Profile } from "@/lib/types";

type Toast = { id: number; type: "success" | "error" | "info"; message: string };
type VolunteerContextValue = {
  user: User | null; profile: Profile | null; events: Event[]; bookings: Booking[]; isLoading: boolean; isCheckingAccess: boolean; loadError: string | null;
  refreshData: () => Promise<void>; createUserBooking: (event: Event, selectedSlot: string) => Promise<string | null>; cancelBooking: (bookingId: number) => Promise<void>; showToast: (type: Toast["type"], message: string) => void; toasts: Toast[];
};
const VolunteerContext = createContext<VolunteerContextValue | null>(null);

export function VolunteerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null); const [profile, setProfile] = useState<Profile | null>(null); const [events, setEvents] = useState<Event[]>([]); const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true); const [isCheckingAccess, setIsCheckingAccess] = useState(true); const [loadError, setLoadError] = useState<string | null>(null); const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((type: Toast["type"], message: string) => { const id = Date.now(); setToasts((current) => [...current, { id, type, message }]); window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000); }, []);

  useEffect(() => { async function guardVolunteerAccess() { try { const currentUser = await getCurrentUser(); if (!currentUser) { router.replace("/"); return; } const { data: roleProfile, error: roleError } = await fetchUserRole(currentUser.id); if (roleProfile?.role === "admin") { router.replace("/admin"); return; } if (roleError && roleError.code !== "PGRST116") { throw roleError; } const resolvedProfile = roleProfile ?? (await ensureUserProfile(currentUser.id, currentUser.email, currentUser.user_metadata.full_name)).data; if (!resolvedProfile || resolvedProfile.role !== "volunteer") { router.replace("/"); return; } setUser(currentUser); setProfile(resolvedProfile as Profile); } catch (error) { console.error("Failed to verify volunteer access:", error); router.replace("/"); } finally { setIsCheckingAccess(false); } } void guardVolunteerAccess(); }, [router]);

  const refreshData = useCallback(async () => { setIsLoading(true); setLoadError(null); try { const [eventsResult, bookingsResult] = await Promise.all([fetchEventsForVolunteer(), fetchBookingsForVolunteer()]); if (eventsResult.error || bookingsResult.error) throw eventsResult.error ?? bookingsResult.error; setEvents(eventsResult.data ?? []); setBookings(bookingsResult.data ?? []); } catch (error) { console.error("Failed to load volunteer data:", error); setLoadError("Volunteer data could not be loaded. Please try again."); } finally { setIsLoading(false); } }, []);

  useEffect(() => { if (isCheckingAccess || !user) return; queueMicrotask(() => void refreshData()); const bookingsChannel = supabase.channel("volunteer-bookings").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refreshData()).subscribe(); const eventsChannel = supabase.channel("volunteer-events").on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refreshData()).subscribe(); return () => { void bookingsChannel.unsubscribe(); void eventsChannel.unsubscribe(); }; }, [isCheckingAccess, refreshData, user]);

  const createUserBooking = useCallback(async (event: Event, selectedSlot: string) => { if (!user || !profile) return "Please sign in before booking an event."; if (bookings.some((booking) => booking.event_id === event.id && booking.user_id === user.id)) return "You are already signed up for this event."; const { error } = await createBooking({ event_id: event.id, user_id: user.id, volunteer_name: profile.full_name || user.email?.split("@")[0] || "Volunteer", volunteer_email: user.email ?? null, selected_slot: selectedSlot, status: "Confirmed" }); if (error) { console.error("Failed to create booking:", error); return "This booking could not be created. Please try again."; } await refreshData(); showToast("success", `You are signed up for ${event.title}.`); return null; }, [bookings, profile, refreshData, showToast, user]);
  const cancelBooking = useCallback(async (bookingId: number) => { if (!user) return; const { error } = await cancelUserBooking(bookingId, user.id); if (error) { console.error("Failed to cancel booking:", error); showToast("error", "This booking could not be cancelled. Please try again."); return; } await refreshData(); showToast("info", "Booking cancelled."); }, [refreshData, showToast, user]);

  return <VolunteerContext.Provider value={{ user, profile, events, bookings, isLoading, isCheckingAccess, loadError, refreshData, createUserBooking, cancelBooking, showToast, toasts }}>{children}</VolunteerContext.Provider>;
}
export function useVolunteerData() { const context = useContext(VolunteerContext); if (!context) throw new Error("useVolunteerData must be used inside VolunteerProvider"); return context; }
