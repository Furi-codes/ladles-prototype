"use client";

import PageHeader from "../components/PageHeader";
import VolunteerAttendance from "../components/VolunteerAttendance";
import { useAdminData } from "../components/AdminProvider";

export default function VolunteersPage() {
  const { events, eventSlots, bookings, attendanceRecords } = useAdminData();
  return <><PageHeader activeNav="Volunteers" /><VolunteerAttendance events={events} eventSlots={eventSlots} bookings={bookings} attendanceRecords={attendanceRecords} /></>;
}
