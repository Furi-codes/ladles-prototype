"use client";

/** Shares the volunteer's account, bookings, attendance, inbox and UI actions across portal pages. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole, fetchVolunteerConsent, requestVolunteerEmailChange, saveVolunteerAvatar, saveVolunteerConsent, updateVolunteerProfile } from "@/lib/actions/profile";
import { bookEventSlot, cancelUserBooking, ensureUserProfile, fetchBookingsForVolunteer, fetchEventsForVolunteer, fetchEventSlotsForVolunteer, fetchVolunteerAttendanceRecords, fetchVolunteerNotifications, markVolunteerNotificationRead, markVolunteerNotificationsRead } from "@/lib/actions/volunteer";
import type { AttendanceRecord, Booking, Event, EventSlot, Notification, Profile, VolunteerConsent } from "@/lib/types";
import { useProfilePhotoUrl } from "./useProfilePhotoUrl";
import { fetchVolunteerReminderPreference, saveVolunteerReminderPreference } from "@/lib/actions/volunteer";
import { corporateRolloutEnabled } from "@/lib/feature-flags";
import { isValidPhone } from "@/lib/contact-details";

/** Short-lived UI feedback; these messages are separate from stored inbox notifications. */
type Toast = { id: number; type: "success" | "error" | "info"; message: string };
/** The data/actions children receive through useVolunteerData instead of passing them through every page. */
type VolunteerContextValue = {
  user: User | null;
  profile: Profile | null;
  avatarUrl: string | null;
  consent: VolunteerConsent | null;
  events: Event[];
  eventSlots: EventSlot[];
  bookings: Booking[];
  attendanceRecords: AttendanceRecord[];
  notifications: Notification[];
  notificationsLoading: boolean;
  notificationError: string | null;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  remindersEnabled: boolean | null;
  reminderPreferenceError: string | null;
  loadReminderPreference: () => Promise<void>;
  saveReminderPreference: (enabled: boolean) => Promise<string | null>;
  isLoading: boolean;
  isCheckingAccess: boolean;
  loadError: string | null;
  refreshData: () => Promise<void>;
  createUserBooking: (slot: EventSlot) => Promise<string | null>;
  cancelBooking: (bookingId: number) => Promise<void>;
  dismissNotification: (notificationId: number) => Promise<void>;
  saveProfile: (data: { full_name: string; date_of_birth: string; phone?: string }) => Promise<string | null>;
  saveAvatar: (photo: Blob | null) => Promise<string | null>;
  requestEmailChange: (email: string) => Promise<string | null>;
  acceptConsent: () => Promise<string | null>;
  showToast: (type: Toast["type"], message: string) => void;
  toasts: Toast[];
};

const VolunteerContext = createContext<VolunteerContextValue | null>(null);
export const CONSENT_VERSION = "2026-09-14";

/** Checks the account, loads related rows and exposes actions that save then update shared state. */
export function VolunteerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedAvatar, setSavedAvatar] = useState<{ path: string; url: string } | null>(null);
  const [consent, setConsent] = useState<VolunteerConsent | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventSlots, setEventSlots] = useState<EventSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  // Request numbers prevent a slower, older inbox response from replacing newer results.
  const notificationRequest = useRef(0);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean | null>(null);
  const [reminderPreferenceError, setReminderPreferenceError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Use the new local image immediately, but only while it matches the saved profile path.
  const savedAvatarUrl = savedAvatar?.path === profile?.avatar_path ? savedAvatar?.url ?? null : null;
  const avatarUrl = useProfilePhotoUrl(
    profile?.avatar_path,
    savedAvatarUrl,
  );

  useEffect(() => () => {
    // Object URLs hold browser memory, so release them when replaced or on unmount.
    if (savedAvatar) URL.revokeObjectURL(savedAvatar.url);
  }, [savedAvatar]);

  /** Adds feedback for five seconds without writing anything to the notifications table. */
  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  }, []);

  useEffect(() => {
    /** Redirects absent/admin accounts and resolves a volunteer profile/consent before loading portal data. */
    async function guardVolunteerAccess() {
      let isRedirecting = false;
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          isRedirecting = true;
          router.replace("/");
          return;
        }

        const { data: roleProfile, error: roleError } = await fetchUserRole(currentUser.id);
        if (roleProfile?.role === "admin") {
          isRedirecting = true;
          router.replace("/admin");
          return;
        }
        if (roleError && roleError.code !== "PGRST116") throw roleError;

        const metadataDateOfBirth = typeof currentUser.user_metadata.date_of_birth === "string" ? currentUser.user_metadata.date_of_birth : undefined;
        // Metadata supplies editable profile defaults, not the role used for the access decision.
        const { data: resolvedProfile, error: profileError } = await ensureUserProfile(currentUser.id, currentUser.email, currentUser.user_metadata.full_name, metadataDateOfBirth);
        if (profileError) throw profileError;
        if (!resolvedProfile || resolvedProfile.role !== "volunteer") {
          isRedirecting = true;
          router.replace("/");
          return;
        }
        if (resolvedProfile.volunteer_enabled === false) {
          isRedirecting = true;
          router.replace("/corporate");
          return;
        }

        const { data: savedConsent, error: consentError } = await fetchVolunteerConsent();
        if (consentError) throw consentError;
        setUser(currentUser);
        setProfile(resolvedProfile as Profile);
        setConsent(savedConsent);
      } catch (error) {
        console.error("Failed to verify volunteer access:", error);
        isRedirecting = true;
        router.replace("/");
      } finally {
        // Keep the loading/access screen visible while a redirect is underway.
        if (!isRedirecting) setIsCheckingAccess(false);
      }
    }

    void guardVolunteerAccess();
  }, [router]);

  /** Loads the four related datasets together, keeping existing state if any query fails. */
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [eventsResult, eventSlotsResult, bookingsResult, attendanceResult] = await Promise.all([
        fetchEventsForVolunteer(),
        fetchEventSlotsForVolunteer(),
        fetchBookingsForVolunteer(),
        fetchVolunteerAttendanceRecords(),
      ]);
      if (eventsResult.error || eventSlotsResult.error || bookingsResult.error || attendanceResult.error) {
        throw eventsResult.error ?? eventSlotsResult.error ?? bookingsResult.error ?? attendanceResult.error;
      }
      setEvents(eventsResult.data ?? []);
      setEventSlots(eventSlotsResult.data ?? []);
      setBookings(bookingsResult.data ?? []);
      setAttendanceRecords(attendanceResult.data ?? []);
    } catch (error) {
      console.error("Failed to load volunteer data:", error);
      setLoadError("Volunteer data could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Reloads this user's inbox. Only the latest request can update inbox/error/loading state. */
  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const request = ++notificationRequest.current;
    setNotificationsLoading(true);
    try {
      const { data, error } = await fetchVolunteerNotifications(user.id);
      if (request !== notificationRequest.current) return;
      if (error) throw error;
      setNotifications(data ?? []);
      setNotificationError(null);
    } catch {
      if (request === notificationRequest.current) setNotificationError("Your notifications could not be loaded. Please try again.");
    } finally { if (request === notificationRequest.current) setNotificationsLoading(false); }
  }, [user]);

  /** Reads the personal reminder switch; no stored preference means reminders start enabled. */
  const loadReminderPreference = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await fetchVolunteerReminderPreference(user.id);
      if (error) throw error;
      setRemindersEnabled(data?.reminders_enabled ?? true);
      setReminderPreferenceError(null);
    } catch { setReminderPreferenceError("Your notification preference could not be loaded."); }
  }, [user]);

  useEffect(() => {
    if (!isCheckingAccess && user) queueMicrotask(() => void loadReminderPreference());
  }, [isCheckingAccess, loadReminderPreference, user]);

  /** Saves the switch and confirms the returned boolean before updating the UI; returns an error or null. */
  const saveReminderPreference = useCallback(async (enabled: boolean) => {
    if (!user) return "Please sign in to change notification preferences.";
    try {
      const { data, error } = await saveVolunteerReminderPreference(enabled);
      if (error || typeof data !== "boolean") throw error ?? new Error("Preference not confirmed.");
      setRemindersEnabled(data);
      setReminderPreferenceError(null);
      await refreshNotifications();
      showToast("success", data ? "Shift reminder notifications are on." : "Shift reminder notifications are off. Cancellation notices remain enabled.");
      return null;
    } catch { return "Your preference could not be saved. Please try again."; }
  }, [refreshNotifications, showToast, user]);

  useEffect(() => {
    if (isCheckingAccess || !user) return;
    // Realtime refreshes changes promptly; the visible-tab timer/focus refresh is an additional fallback.
    queueMicrotask(() => void refreshNotifications());
    const channel = supabase.channel(`volunteer-notifications-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void refreshNotifications()).subscribe();
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refreshNotifications(); };
    const interval = window.setInterval(refreshWhenVisible, 60000);
    window.addEventListener("focus", refreshWhenVisible);
    return () => { void channel.unsubscribe(); window.clearInterval(interval); window.removeEventListener("focus", refreshWhenVisible); };
  }, [isCheckingAccess, refreshNotifications, user]);

  useEffect(() => {
    if (isCheckingAccess || !user) return;
    // These listeners reload related data; they do not create reminders or enforce database permissions.
    queueMicrotask(() => void refreshData());
    const bookingsChannel = supabase.channel("volunteer-bookings").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refreshData()).subscribe();
    const eventsChannel = supabase.channel("volunteer-events").on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refreshData()).subscribe();
    const eventSlotsChannel = supabase.channel("volunteer-event-slots").on("postgres_changes", { event: "*", schema: "public", table: "event_slots" }, () => void refreshData()).subscribe();
    const attendanceChannel = supabase.channel("volunteer-attendance").on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => void refreshData()).subscribe();
    return () => {
      void bookingsChannel.unsubscribe();
      void eventsChannel.unsubscribe();
      void eventSlotsChannel.unsubscribe();
      void attendanceChannel.unsubscribe();
    };
  }, [isCheckingAccess, refreshData, user]);

  /** Rejects obvious duplicates in loaded state, calls the booking RPC, then refreshes and shows feedback. */
  const createUserBooking = useCallback(async (slot: EventSlot) => {
    // Check signed-in profile and already-loaded bookings before sending the create request.
    if (!user || !profile) return "Please sign in before booking an event.";
    if (bookings.some((booking) => booking.event_id === slot.event_id && booking.user_id === user.id)) return "You are already signed up for this event.";
    if (corporateRolloutEnabled && !isValidPhone(profile.phone ?? '')) return "Add your cellphone number in My profile before making a new booking. Existing attendance and cancellation remain available.";
    // This UI check is for feedback; the database must recheck rules against current data.
    const { error } = await bookEventSlot(slot.id);
    if (error) {
      console.error("Failed to create booking:", error);
      return error.message || "This booking could not be created. Please try again.";
    }
    // Reload shared data after the request so the booking list reflects the database response.
    await refreshData();
    showToast("success", "You are signed up for this event.");
    return null;
  }, [bookings, profile, refreshData, showToast, user]);

  /** Deletes a booking scoped to this user; refreshes shared rows only after a successful request. */
  const cancelBooking = useCallback(async (bookingId: number) => {
    if (!user) return;
    const { error } = await cancelUserBooking(bookingId, user.id);
    if (error) {
      console.error("Failed to cancel booking:", error);
      showToast("error", "This booking could not be cancelled. Please try again.");
      return;
    }
    await refreshData();
    showToast("info", "Booking cancelled.");
  }, [refreshData, showToast, user]);

  /** Marks one notice read, updates local state after success, and reloads the inbox. */
  const dismissNotification = useCallback(async (notificationId: number) => {
    if (!user) return;
    try {
      const { error } = await markVolunteerNotificationRead(notificationId, user.id);
      if (error) throw error;
      setNotifications(current => current.map(notification => notification.id === notificationId ? { ...notification, is_read: true } : notification));
      void refreshNotifications();
    } catch { showToast("error", "This update could not be marked read. Please try again."); }
  }, [refreshNotifications, showToast, user]);

  /** Sends only loaded unread IDs; actual updated IDs allow partial success to appear correctly. */
  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    try {
      const { ids, error } = await markVolunteerNotificationsRead(notifications.filter(item => !item.is_read).map(item => item.id), user.id);
      setNotifications(current => current.map(item => ids.includes(item.id) ? { ...item, is_read: true } : item));
      void refreshNotifications();
      if (error) throw error;
    } catch { showToast("error", "Some updates could not be marked read. Please try again."); }
  }, [notifications, refreshNotifications, showToast, user]);

  /** Saves editable details and replaces the shared profile with the returned database row. */
  const saveProfile = useCallback(async (data: { full_name: string; date_of_birth: string; phone?: string }) => {
    if (!user) return "Please sign in before updating your profile.";
    const { data: updatedProfile, error } = await updateVolunteerProfile(user.id, data);
    if (error || !updatedProfile) {
      console.error("Failed to save volunteer profile:", error);
      return error?.message || "Your profile could not be saved. Please try again.";
    }
    setProfile(updatedProfile as Profile);
    showToast("success", "Your profile has been updated.");
    return null;
  }, [showToast, user]);

  /** Saves/removes a prepared photo; a local URL displays a saved upload before its signed URL loads. */
  const saveAvatar = useCallback(async (photo: Blob | null) => {
    if (!user || !profile) return "Please sign in before updating your profile photo.";
    const { data: updatedProfile, error } = await saveVolunteerAvatar(user.id, photo);
    if (error || !updatedProfile) {
      console.error("Failed to save volunteer photo:", error);
      return error ?? "Your profile photo could not be saved. Please try again.";
    }

    setSavedAvatar((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return photo && updatedProfile.avatar_path
        ? { path: updatedProfile.avatar_path, url: URL.createObjectURL(photo) }
        : null;
    });
    setProfile(updatedProfile as Profile);
    showToast("success", photo ? "Your profile photo has been updated." : "Your profile photo has been removed.");
    return null;
  }, [profile, showToast, user]);

  /** Starts Auth's email verification flow; this does not immediately overwrite the profile email. */
  const requestEmailChange = useCallback(async (email: string) => {
    const { error } = await requestVolunteerEmailChange(email);
    if (error) {
      console.error("Failed to request email change:", error);
      return error.message || "Your email change could not be requested. Please try again.";
    }
    showToast("info", "Check both email inboxes to confirm your new email address.");
    return null;
  }, [showToast]);

  /** Stores the current agreement version and updates the consent shared with onboarding components. */
  const acceptConsent = useCallback(async () => {
    const { data: savedConsent, error } = await saveVolunteerConsent(CONSENT_VERSION);
    if (error || !savedConsent) {
      console.error("Failed to save volunteer consent:", error);
      return "Your consent could not be saved. Please try again.";
    }
    setConsent(savedConsent as VolunteerConsent);
    showToast("success", "Thank you. Your volunteer onboarding is complete.");
    return null;
  }, [showToast]);

  return <VolunteerContext.Provider value={{ user, profile, avatarUrl, consent, events, eventSlots, bookings, attendanceRecords, notifications, notificationsLoading, notificationError, refreshNotifications, markAllNotificationsRead, remindersEnabled, reminderPreferenceError, loadReminderPreference, saveReminderPreference, isLoading, isCheckingAccess, loadError, refreshData, createUserBooking, cancelBooking, dismissNotification, saveProfile, saveAvatar, requestEmailChange, acceptConsent, showToast, toasts }}>{children}</VolunteerContext.Provider>;
}

/** Accesses the shared provider; using this hook outside its wrapper is a programming error. */
export function useVolunteerData() {
  const context = useContext(VolunteerContext);
  if (!context) throw new Error("useVolunteerData must be used inside VolunteerProvider");
  return context;
}
