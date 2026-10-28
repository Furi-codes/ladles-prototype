"use client";
/**
 * Opens the volunteer event management at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import PageHeader from "@/presentation/admin/shell/PageHeader";
import EventsManager from "@/presentation/admin/events/EventsManager";
import { useAdminData } from "@/presentation/admin/shell/AdminProvider";
import { FeatureState } from '@/presentation/components/ui/FeatureShared';

export default function EventsPage() {
  const { events, eventSlots, attendanceCheckpoints, isLoading, loadError, fetchData } = useAdminData();
  return <><PageHeader activeNav="Events" />{loadError ? <FeatureState loading={isLoading} error={loadError} retry={() => void fetchData()} /> : <EventsManager events={events} eventSlots={eventSlots} attendanceCheckpoints={attendanceCheckpoints} isLoading={isLoading} fetchData={fetchData} />}</>;
}
