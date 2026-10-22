"use client";

import PageHeader from "./components/PageHeader";
import Dashboard from "./components/Dashboard";
import { useAdminData } from "./components/AdminProvider";

export default function AdminPage() {
  const { bookings, events, eventSlots, volunteers, isLoading, loadError } = useAdminData();
  return <><PageHeader activeNav="Dashboard" /><Dashboard bookings={bookings} events={events} eventSlots={eventSlots} volunteers={volunteers} isLoading={isLoading} hasError={Boolean(loadError)} /></>;
}
