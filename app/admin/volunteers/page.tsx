"use client";

import PageHeader from "../components/PageHeader";
import VolunteerAttendance from "../components/VolunteerAttendance";
import { useAdminData } from "../components/AdminProvider";

export default function VolunteersPage() {
  const { events, bookings, attendanceRecords } = useAdminData();
  return <><PageHeader activeNav="Volunteers" /><VolunteerAttendance events={events} bookings={bookings} attendanceRecords={attendanceRecords} /></>;
}
