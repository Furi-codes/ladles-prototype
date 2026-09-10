"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, Event, Volunteer } from "../../../lib/types";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole } from "@/lib/actions/profile";
import { fetchAdminBookings, fetchAdminEvents, fetchVolunteers } from "@/lib/actions/admin";

type AdminProfile = { full_name?: string; email?: string };
type AdminContextValue = {
  events: Event[];
  bookings: Booking[];
  volunteers: Volunteer[];
  adminProfile: AdminProfile;
  isLoading: boolean;
  isCheckingAccess: boolean;
  loadError: string | null;
  fetchData: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function guardAdminAccess() {
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data: profile, error } = await fetchUserRole(user.id);
      if (error || !profile || profile.role !== "admin") {
        router.replace("/volunteer");
        return;
      }

      setAdminProfile({ full_name: profile.full_name, email: profile.email });
      setIsCheckingAccess(false);
    }

    void guardAdminAccess();
  }, [router]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [eventsResult, bookingsResult, volunteersResult] = await Promise.all([
        fetchAdminEvents(),
        fetchAdminBookings(),
        fetchVolunteers(),
      ]);

      if (eventsResult.error || bookingsResult.error || volunteersResult.error) {
        throw eventsResult.error ?? bookingsResult.error ?? volunteersResult.error;
      }

      setEvents(eventsResult.data ?? []);
      setBookings(bookingsResult.data ?? []);
      setVolunteers(volunteersResult.data ?? []);
    } catch (error) {
      console.error("Failed to load admin data:", error);
      setLoadError("Admin data could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCheckingAccess) return;

    queueMicrotask(() => void fetchData());
    const bookingSubscription = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void fetchData())
      .subscribe();
    const eventSubscription = supabase
      .channel("admin-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void fetchData())
      .subscribe();

    return () => {
      void bookingSubscription.unsubscribe();
      void eventSubscription.unsubscribe();
    };
  }, [fetchData, isCheckingAccess]);

  return <AdminContext.Provider value={{ events, bookings, volunteers, adminProfile, isLoading, isCheckingAccess, loadError, fetchData }}>{children}</AdminContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdminData must be used inside AdminProvider");
  return context;
}
