"use client";
/**
 * Opens the admin dashboard at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import PageHeader from "@/presentation/admin/shell/PageHeader";
import Dashboard from "@/presentation/admin/dashboard/Dashboard";
import { useAdminData } from "@/presentation/admin/shell/AdminProvider";

export default function AdminPage() {
  const { bookings, events, eventSlots, volunteers, isLoading, loadError } = useAdminData();
  return <><PageHeader activeNav="Dashboard" /><Dashboard bookings={bookings} events={events} eventSlots={eventSlots} volunteers={volunteers} isLoading={isLoading} hasError={Boolean(loadError)} /></>;
}
