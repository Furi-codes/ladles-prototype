import { getIntegrationDatabase, jsonError, requireWmsAuthentication } from "@/lib/server/wms-integration";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ externalEventId: string }> };
type Slot = { id: number; external_timeslot_id: string | null; capacity: number };
type Booking = { id: number; event_slot_id: number | null; status: string; user_id: string; volunteer_name: string | null; volunteer_email: string | null };
type Profile = { id: string; full_name: string; email: string | null; phone: string | null };
type CorporateBooking = { event_slot_id: number; team_size: number; status: string };

/** Returns the current portal booking snapshot for one WMS-owned event. */
export async function GET(request: Request, context: RouteContext) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;

  const { externalEventId } = await context.params;
  try {
    const database = getIntegrationDatabase();
    const { data: event, error: eventError } = await database
      .from("events")
      .select("id")
      .eq("external_event_id", externalEventId)
      .maybeSingle();

    if (eventError) {
      console.error("WMS booking event lookup failed:", eventError);
      return jsonError(eventError.message, 500);
    }
    if (!event) return jsonError("The external event was not found.", 404);

    const { data: slots, error: slotsError } = await database
      .from("event_slots")
      .select("id, external_timeslot_id, capacity")
      .eq("event_id", event.id)
      .not("external_timeslot_id", "is", null)
      .order("start_time", { ascending: true });
    if (slotsError) return jsonError(slotsError.message, 500);

    const slotRows = (slots ?? []) as Slot[];
    const slotIds = slotRows.map((slot) => slot.id);
    if (!slotIds.length) {
      return Response.json({ externalEventId, bookingCount: 0, capacityTotal: 0, timeslots: [], bookings: [] });
    }

    const [{ data: bookings, error: bookingsError }, { data: corporateBookings, error: corporateError }] = await Promise.all([
      database.from("bookings").select("id, event_slot_id, status, user_id, volunteer_name, volunteer_email").in("event_slot_id", slotIds),
      database.from("corporate_bookings").select("event_slot_id, team_size, status").in("event_slot_id", slotIds).neq("status", "Cancelled"),
    ]);
    if (bookingsError) return jsonError(bookingsError.message, 500);
    if (corporateError) return jsonError(corporateError.message, 500);

    const bookingRows = (bookings ?? []) as Booking[];
    const volunteerIds = [...new Set(bookingRows.map((booking) => booking.user_id))];
    const profileResult = volunteerIds.length
      ? await database.from("profiles").select("id, full_name, email, phone").in("id", volunteerIds)
      : { data: [] as Profile[], error: null };
    if (profileResult.error) return jsonError(profileResult.error.message, 500);

    const profiles = new Map(((profileResult.data ?? []) as Profile[]).map((profile) => [profile.id, profile]));
    const bookingCounts = new Map<number, number>();
    const corporateReservations = new Map<number, number>();
    for (const booking of bookingRows) {
      if (booking.event_slot_id !== null) bookingCounts.set(booking.event_slot_id, (bookingCounts.get(booking.event_slot_id) ?? 0) + 1);
    }
    for (const booking of (corporateBookings ?? []) as CorporateBooking[]) {
      corporateReservations.set(booking.event_slot_id, (corporateReservations.get(booking.event_slot_id) ?? 0) + booking.team_size);
    }

    return Response.json({
      externalEventId,
      bookingCount: bookingRows.length,
      capacityTotal: slotRows.reduce((total, slot) => total + slot.capacity, 0),
      timeslots: slotRows.map((slot) => ({
        vmsTimeslotId: slot.id,
        externalTimeslotId: slot.external_timeslot_id,
        capacity: slot.capacity,
        remaining: Math.max(0, slot.capacity - (bookingCounts.get(slot.id) ?? 0) - (corporateReservations.get(slot.id) ?? 0)),
        bookingCount: bookingCounts.get(slot.id) ?? 0,
      })),
      bookings: bookingRows.map((booking) => {
        const profile = profiles.get(booking.user_id);
        return {
          vmsBookingId: booking.id,
          externalTimeslotId: slotRows.find((slot) => slot.id === booking.event_slot_id)?.external_timeslot_id ?? null,
          status: "CONFIRMED",
          vmsStatus: booking.status,
          volunteer: {
            vmsVolunteerId: booking.user_id,
            name: profile?.full_name ?? booking.volunteer_name ?? "Volunteer",
            email: profile?.email ?? booking.volunteer_email ?? null,
            phone: profile?.phone ?? null,
          },
        };
      }),
    });
  } catch (error) {
    console.error("WMS booking integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
