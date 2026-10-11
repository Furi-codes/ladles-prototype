"use client";

/** Shared admin data/loading state used by dashboard, event and volunteer roster screens. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceCheckpoint, AttendanceRecord, Booking, Event, EventSlot, Volunteer } from "../../../lib/types";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole } from "@/lib/actions/profile";
import { fetchAdminAttendanceCheckpoints, fetchAdminAttendanceRecords, fetchAdminBookings, fetchAdminEvents, fetchAdminEventSlots, fetchVolunteers, markMissedBookingsNoShow } from "@/lib/actions/admin";

/** Header identity fields loaded after the profile passes the admin role check. */
type AdminProfile = { full_name?: string; email?: string };
/** Related table rows and the refresh action made available through useAdminData. */
type AdminContextValue = {
  events: Event[];
  bookings: Booking[];
  attendanceRecords: AttendanceRecord[];
  eventSlots: EventSlot[];
  attendanceCheckpoints: AttendanceCheckpoint[];
  volunteers: Volunteer[];
  adminProfile: AdminProfile;
  isLoading: boolean;
  isCheckingAccess: boolean;
  loadError: string | null;
  fetchData: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

/** Guards the admin UI, loads shared datasets and reloads them on subscribed database changes. */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [eventSlots, setEventSlots] = useState<EventSlot[]>([]);
  const [attendanceCheckpoints, setAttendanceCheckpoints] = useState<AttendanceCheckpoint[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A later refresh invalidates earlier requests, so a slow response cannot restore older data.
  const refreshRequest = useRef(0);

  useEffect(() => {
    /** Checks Auth and the stored role before showing admin content. RLS still protects database access. */
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

  /** Requests no-show finalisation, then loads six datasets in parallel; only the latest request updates state. */
  const fetchData = useCallback(async () => {
    const request = ++refreshRequest.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      // Ask SQL to finalise missed bookings before reading them. Its implementation controls eligibility.
      const { error: noShowError } = await markMissedBookingsNoShow();
      if (request !== refreshRequest.current) return;
      if (noShowError && noShowError.code !== "PGRST202") {
        // A no-show failure is logged, but does not prevent normal data reads below.
        console.error("Failed to finalize no-shows:", noShowError);
      }

      const [eventsResult, bookingsResult, eventSlotsResult, volunteersResult, checkpointsResult, attendanceResult] = await Promise.all([
        fetchAdminEvents(),
        fetchAdminBookings(),
        fetchAdminEventSlots(),
        fetchVolunteers(),
        fetchAdminAttendanceCheckpoints(),
        fetchAdminAttendanceRecords(),
      ]);

      if (request !== refreshRequest.current) return;
      if (eventsResult.error || bookingsResult.error || eventSlotsResult.error || volunteersResult.error || checkpointsResult.error || attendanceResult.error) {
        throw eventsResult.error ?? bookingsResult.error ?? eventSlotsResult.error ?? volunteersResult.error ?? checkpointsResult.error ?? attendanceResult.error;
      }

      setEvents(eventsResult.data ?? []);
      setBookings(bookingsResult.data ?? []);
      setEventSlots(eventSlotsResult.data ?? []);
      setAttendanceCheckpoints(checkpointsResult.data ?? []);
      setAttendanceRecords(attendanceResult.data ?? []);
      setVolunteers(volunteersResult.data ?? []);
    } catch (error) {
      if (request !== refreshRequest.current) return;
      console.error("Failed to load admin data:", error);
      setLoadError("Admin data could not be loaded. Please try again.");
    } finally {
      if (request === refreshRequest.current) setIsLoading(false);
    }
  }, []);

  /** Makes any in-flight response stale during effect cleanup/unmount. */
  const invalidateRefresh = useCallback(() => { ++refreshRequest.current; }, []);

  useEffect(() => {
    if (isCheckingAccess) return;

    let active = true;
    // The active flag prevents the queued initial refresh from running after cleanup.
    queueMicrotask(() => { if (active) void fetchData(); });
    const bookingSubscription = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void fetchData())
      .subscribe();
    const eventSubscription = supabase
      .channel("admin-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void fetchData())
      .subscribe();
    const eventSlotSubscription = supabase
      .channel("admin-event-slots")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_slots" }, () => void fetchData())
      .subscribe();
    const attendanceSubscription = supabase
      .channel("admin-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => void fetchData())
      .subscribe();

    return () => {
      // Stop listeners and invalidate outstanding reads before the provider/effect is replaced.
      active = false;
      invalidateRefresh();
      void bookingSubscription.unsubscribe();
      void eventSubscription.unsubscribe();
      void eventSlotSubscription.unsubscribe();
      void attendanceSubscription.unsubscribe();
    };
  }, [fetchData, invalidateRefresh, isCheckingAccess]);

  return <AdminContext.Provider value={{ events, bookings, attendanceRecords, eventSlots, attendanceCheckpoints, volunteers, adminProfile, isLoading, isCheckingAccess, loadError, fetchData }}>{children}</AdminContext.Provider>;
}

/** Gets the shared admin context, throwing if a component is outside AdminProvider. */
export function useAdminData() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdminData must be used inside AdminProvider");
  return context;
}
