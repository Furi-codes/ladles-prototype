"use client";
import { watchAdminRecords } from '@/business/admin/subscriptions';
import { getAuthenticatedUser } from '@/business/shared/auth/session';

/**
 * Shares the admin profile and related volunteer datasets with admin screens.
 * A stored role check guards the UI, and request counters stop older refreshes from replacing
 * newer results. Database permissions remain separate.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceCheckpoint, AttendanceRecord, Booking, Event, EventSlot, Volunteer } from "@/business/shared/types";
import { fetchUserRole } from "@/business/shared/accounts/profile";
import { fetchAdminAttendanceCheckpoints, fetchAdminAttendanceRecords, fetchAdminBookings, fetchAdminEvents, fetchAdminEventSlots, fetchVolunteers, markMissedBookingsNoShow } from "@/business/admin/services/management";

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
  accessError: string | null;
  retryAccess: () => void;
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
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessAttempt, setAccessAttempt] = useState(0);
  // A later refresh invalidates earlier requests, so a slow response cannot restore older data.
  const refreshRequest = useRef(0);

  useEffect(() => {
    let active = true;
    /** Checks Auth and the stored role before showing admin content. RLS still protects database access. */
    async function guardAdminAccess() {
      try {
        const { data, error: authError } = await getAuthenticatedUser();
        if (!active) return;
        if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
        if (!data.user) { router.replace("/"); return; }
        const { data: profile, error } = await fetchUserRole(data.user.id);
        if (!active) return;
        // A failed role lookup is not proof that this user is a volunteer.
        if (error) throw error;
        if (!profile) throw new Error('Profile unavailable.');
        if (profile.role !== "admin") { router.replace("/volunteer"); return; }
        setAdminProfile({ full_name: profile.full_name, email: profile.email });
        setAccessError(null);
        setIsCheckingAccess(false);
      } catch {
        if (active) setAccessError('Admin access could not be checked. Check your connection and retry.');
      }
    }

    void guardAdminAccess();
    return () => { active = false; };
  }, [router, accessAttempt]);

  const retryAccess = () => { setAccessError(null); setAccessAttempt(value => value + 1); };

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
    const bookingSubscription = watchAdminRecords("admin-bookings", "bookings", () => void fetchData());
    const eventSubscription = watchAdminRecords("admin-events", "events", () => void fetchData());
    const eventSlotSubscription = watchAdminRecords("admin-event-slots", "event_slots", () => void fetchData());
    const attendanceSubscription = watchAdminRecords("admin-attendance", "attendance_records", () => void fetchData());

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

  return <AdminContext.Provider value={{ events, bookings, attendanceRecords, eventSlots, attendanceCheckpoints, volunteers, adminProfile, isLoading, isCheckingAccess, accessError, retryAccess, loadError, fetchData }}>{children}</AdminContext.Provider>;
}

/** Gets the shared admin context, throwing if a component is outside AdminProvider. */
export function useAdminData() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdminData must be used inside AdminProvider");
  return context;
}

