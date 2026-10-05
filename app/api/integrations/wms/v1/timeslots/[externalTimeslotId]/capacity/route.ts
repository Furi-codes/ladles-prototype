import {
  getIntegrationDatabase,
  integrationErrorStatus,
  jsonError,
  logWmsAction,
  parsePositiveInteger,
  readJsonRecord,
  requireJsonContent,
  requireWmsAuthentication,
} from "@/lib/server/wms-integration";
import { fetchAllPages } from "@/lib/data-pagination";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ externalTimeslotId: string }> };

/** Updates capacity only when existing individual and corporate reservations still fit. */
export async function PATCH(request: Request, context: RouteContext) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;
  const contentTypeError = requireJsonContent(request);
  if (contentTypeError) return contentTypeError;

  const { externalTimeslotId } = await context.params;
  const body = await readJsonRecord(request);
  const capacity = body ? parsePositiveInteger(body.capacity) : null;
  if (!capacity) return jsonError("capacity must be a positive integer.", 422);

  try {
    const database = getIntegrationDatabase();
    const { data: slot, error: slotError } = await database
      .from("event_slots")
      .select("id, capacity, event_id")
      .eq("external_timeslot_id", externalTimeslotId)
      .maybeSingle();
    if (slotError) {
      console.error("WMS capacity slot lookup failed:", slotError);
      return jsonError(slotError.message, 500);
    }
    if (!slot) return jsonError("The external timeslot was not found.", 404);

    const [{ count: individualReservations, error: bookingsError }, { data: corporateBookings, error: corporateError }] = await Promise.all([
      database.from("bookings").select("id", { count: "exact", head: true }).eq("event_slot_id", slot.id).neq("status", "Cancelled"),
      fetchAllPages<{ team_size: number }>((from, to) => database.from("corporate_bookings").select("team_size", { count: "exact" }).eq("event_slot_id", slot.id).neq("status", "Cancelled").order("id").range(from, to)),
    ]);
    if (bookingsError) return jsonError(bookingsError.message, 500);
    if (corporateError) return jsonError(corporateError.message, 500);

    const reservedPlaces = (individualReservations ?? 0) + (corporateBookings ?? []).reduce((total, booking) => total + booking.team_size, 0);
    if (capacity < reservedPlaces) {
      return jsonError(`Capacity cannot be lower than the ${reservedPlaces} place${reservedPlaces === 1 ? "" : "s"} already reserved.`, 409);
    }

    const { data: updatedSlot, error: updateError } = await database
      .from("event_slots")
      .update({ capacity })
      .eq("id", slot.id)
      .select("id, capacity")
      .single();
    if (updateError) {
      console.error("WMS capacity update failed:", updateError);
      return jsonError(updateError.message, integrationErrorStatus(updateError.code));
    }

    if (updatedSlot.capacity !== capacity) {
      console.error("WMS capacity update did not persist the requested value.");
      return jsonError("The requested capacity was not saved. Please retry or contact the VMS team.", 500);
    }

    await logWmsAction(database, {
      action: "WMS_CAPACITY_UPDATED",
      entityType: "EVENT_SLOT",
      entityId: updatedSlot.id,
      entityLabel: `Timeslot ${externalTimeslotId}`,
      details: {
        external_timeslot_id: externalTimeslotId,
        event_id: slot.event_id,
        capacity_before: slot.capacity,
        capacity_after: updatedSlot.capacity,
      },
    });
    return Response.json({ vmsTimeslotId: updatedSlot.id, externalTimeslotId, capacity: updatedSlot.capacity });
  } catch (error) {
    console.error("WMS capacity integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
