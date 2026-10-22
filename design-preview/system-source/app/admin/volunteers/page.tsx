"use client";

import PageHeader from "../components/PageHeader";
import VolunteerAttendance from "../components/VolunteerAttendance";
import { useAdminData } from "../components/AdminProvider";
import { FeatureState } from '../components/FeatureShared';

export default function VolunteersPage() {
  const { events, eventSlots, bookings, attendanceRecords, isLoading, loadError, fetchData } = useAdminData();
  return <><PageHeader activeNav="Volunteer rosters" /><FeatureState loading={isLoading} error={loadError ?? ''} retry={() => void fetchData()} />{!isLoading && !loadError && <VolunteerAttendance events={events} eventSlots={eventSlots} bookings={bookings} attendanceRecords={attendanceRecords} />}</>;
}
