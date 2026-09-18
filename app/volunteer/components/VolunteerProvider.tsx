"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useProfilePhotoUrl } from "./useProfilePhotoUrl";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { fetchUserRole, fetchVolunteerConsent, requestVolunteerEmailChange, saveVolunteerConsent, saveVolunteerAvatar, updateVolunteerProfile } from "@/lib/actions/profile";
import { bookEventSlot, cancelUserBooking, ensureUserProfile, fetchBookingsForVolunteer, fetchEventsForVolunteer, fetchEventSlotsForVolunteer, fetchVolunteerAttendanceRecords, fetchVolunteerNotifications, markVolunteerNotificationRead } from "@/lib/actions/volunteer";
import type { AttendanceRecord, Booking, Event, EventSlot, Notification, Profile, VolunteerConsent } from "@/lib/types";

type Toast = { id: number; type: "success" | "error" | "info"; message: string };
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
  isLoading: boolean;
  isCheckingAccess: boolean;
  loadError: string | null;
  refreshData: () => Promise<void>;
  createUserBooking: (slot: EventSlot) => Promise<string | null>;
  cancelBooking: (bookingId: number) => Promise<void>;
  dismissNotification: (notificationId: number) => Promise<void>;
  saveProfile: (data: { full_name: string; date_of_birth: string }) => Promise<string | null>;
  saveAvatar: (photo: Blob | null) => Promise<string | null>;
  requestEmailChange: (email: string) => Promise<string | null>;
  acceptConsent: () => Promise<string | null>;
  showToast: (type: Toast["type"], message: string) => void;
  toasts: Toast[];
};

const VolunteerContext = createContext<VolunteerContextValue | null>(null);
export const CONSENT_VERSION = "2026-09-14";

export function VolunteerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savedAvatar, setSavedAvatar] = useState<{ path: string; url: string } | null>(null);
  const avatarUrl = useProfilePhotoUrl(profile?.avatar_path, savedAvatar?.path === profile?.avatar_path ? savedAvatar?.url ?? null : null);
  useEffect(() => () => { if (savedAvatar) URL.revokeObjectURL(savedAvatar.url); }, [savedAvatar]);
  const [consent, setConsent] = useState<VolunteerConsent | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventSlots, setEventSlots] = useState<EventSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
  }, []);

  useEffect(() => {
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
        const { data: resolvedProfile, error: profileError } = await ensureUserProfile(currentUser.id, currentUser.email, currentUser.user_metadata.full_name, metadataDateOfBirth);
        if (profileError) throw profileError;
        if (!resolvedProfile || resolvedProfile.role !== "volunteer") {
          isRedirecting = true;
          router.replace("/");
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
        if (!isRedirecting) setIsCheckingAccess(false);
      }
    }

    void guardVolunteerAccess();
  }, [router]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [eventsResult, eventSlotsResult, bookingsResult, attendanceResult, notificationsResult] = await Promise.all([
        fetchEventsForVolunteer(),
        fetchEventSlotsForVolunteer(),
        fetchBookingsForVolunteer(),
        fetchVolunteerAttendanceRecords(),
        fetchVolunteerNotifications(),
      ]);
      if (eventsResult.error || eventSlotsResult.error || bookingsResult.error || attendanceResult.error || notificationsResult.error) {
        throw eventsResult.error ?? eventSlotsResult.error ?? bookingsResult.error ?? attendanceResult.error ?? notificationsResult.error;
      }
      setEvents(eventsResult.data ?? []);
      setEventSlots(eventSlotsResult.data ?? []);
      setBookings(bookingsResult.data ?? []);
      setAttendanceRecords(attendanceResult.data ?? []);
      setNotifications(notificationsResult.data ?? []);
    } catch (error) {
      console.error("Failed to load volunteer data:", error);
      setLoadError("Volunteer data could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCheckingAccess || !user) return;
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

  const createUserBooking = useCallback(async (slot: EventSlot) => {
    if (!user || !profile) return "Please sign in before booking an event.";
    if (bookings.some((booking) => booking.event_id === slot.event_id && booking.user_id === user.id)) return "You are already signed up for this event.";
    const { error } = await bookEventSlot(slot.id);
    if (error) {
      console.error("Failed to create booking:", error);
      return error.message || "This booking could not be created. Please try again.";
    }
    await refreshData();
    showToast("success", "You are signed up for this event.");
    return null;
  }, [bookings, profile, refreshData, showToast, user]);

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

  const dismissNotification = useCallback(async (notificationId: number) => {
    const { error } = await markVolunteerNotificationRead(notificationId);
    if (error) {
      console.error("Failed to dismiss notification:", error);
      showToast("error", "This update could not be dismissed. Please try again.");
      return;
    }
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  }, [showToast]);

  const saveProfile = useCallback(async (data: { full_name: string; date_of_birth: string }) => {
    if (!user) return "Please sign in before updating your profile.";
    const { data: updatedProfile, error } = await updateVolunteerProfile(user.id, data);
    if (error || !updatedProfile) {
      console.error("Failed to save volunteer profile:", error);
      return "Your profile could not be saved. Please try again.";
    }
    setProfile(updatedProfile as Profile);
    showToast("success", "Your profile has been updated.");
    return null;
  }, [showToast, user]);

  const saveAvatar = useCallback(async (photo: Blob | null) => {
    if (!user || !profile) return "Please sign in before updating your photo.";
    const { data, error } = await saveVolunteerAvatar(user.id, photo);
    if (error || !data) return error ?? "Your photo could not be saved.";
    setSavedAvatar(photo && data.avatar_path ? { path: data.avatar_path, url: URL.createObjectURL(photo) } : null);
    setProfile((current) => current ? { ...current, avatar_path: data.avatar_path } : data);
    showToast("success", photo ? "Your profile photo has been updated." : "Your profile photo has been removed.");
    return null;
  }, [profile, showToast, user]);

  const requestEmailChange = useCallback(async (email: string) => {
    const { error } = await requestVolunteerEmailChange(email);
    if (error) {
      console.error("Failed to request email change:", error);
      return error.message || "Your email change could not be requested. Please try again.";
    }
    showToast("info", "Check both email inboxes to confirm your new email address.");
    return null;
  }, [showToast]);

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

  return <VolunteerContext.Provider value={{ user, profile, avatarUrl, consent, events, eventSlots, bookings, attendanceRecords, notifications, isLoading, isCheckingAccess, loadError, refreshData, createUserBooking, cancelBooking, dismissNotification, saveProfile, saveAvatar, requestEmailChange, acceptConsent, showToast, toasts }}>{children}</VolunteerContext.Provider>;
}

export function useVolunteerData() {
  const context = useContext(VolunteerContext);
  if (!context) throw new Error("useVolunteerData must be used inside VolunteerProvider");
  return context;
}
