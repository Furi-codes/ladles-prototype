"use client";

import PageHeader from "../components/PageHeader";
import EventsManager from "../components/EventsManager";
import { useAdminData } from "../components/AdminProvider";

export default function EventsPage() {
  const { events, eventSlots, attendanceCheckpoints, isLoading, fetchData } = useAdminData();
  return <><PageHeader activeNav="Events" /><EventsManager events={events} eventSlots={eventSlots} attendanceCheckpoints={attendanceCheckpoints} isLoading={isLoading} fetchData={fetchData} /></>;
}
