"use client";

import PageHeader from "../components/PageHeader";
import EventsManager from "../components/EventsManager";
import { useAdminData } from "../components/AdminProvider";

export default function EventsPage() {
  const { events, eventSlots, isLoading, fetchData } = useAdminData();
  return <><PageHeader activeNav="Events" /><EventsManager events={events} eventSlots={eventSlots} isLoading={isLoading} fetchData={fetchData} /></>;
}
