"use client";
/**
 * Opens the volunteer rosters at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import PageHeader from "@/features/admin/shell/PageHeader";
import VolunteerAttendance from "@/features/admin/rosters/VolunteerAttendance";
import { useAdminData } from "@/features/admin/shell/AdminProvider";
import { FeatureState } from '@/components/ui/FeatureShared';

export default function VolunteersPage() {
  const { events, eventSlots, bookings, attendanceRecords, isLoading, loadError, fetchData } = useAdminData();
  return <><PageHeader activeNav="Volunteer rosters" /><FeatureState loading={isLoading} error={loadError ?? ''} retry={() => void fetchData()} />{!isLoading && !loadError && <VolunteerAttendance events={events} eventSlots={eventSlots} bookings={bookings} attendanceRecords={attendanceRecords} onHoursApproved={() => void fetchData()} />}</>;
}
