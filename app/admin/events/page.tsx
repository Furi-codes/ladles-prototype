"use client";

import PageHeader from "../components/PageHeader";
import EventsManager from "../components/EventsManager";
import { useAdminData } from "../components/AdminProvider";
import { FeatureState } from '../components/FeatureShared';

export default function EventsPage() {
  const { events, eventSlots, attendanceCheckpoints, isLoading, loadError, fetchData } = useAdminData();
  return <><PageHeader activeNav="Events" />{loadError ? <FeatureState loading={isLoading} error={loadError} retry={() => void fetchData()} /> : <EventsManager events={events} eventSlots={eventSlots} attendanceCheckpoints={attendanceCheckpoints} isLoading={isLoading} fetchData={fetchData} />}</>;
}
