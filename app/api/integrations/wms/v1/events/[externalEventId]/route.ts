import {
  getIntegrationDatabase,
  integrationErrorStatus,
  jsonError,
  logWmsAction,
  parseWmsEventPayload,
  readJsonRecord,
  requireJsonContent,
  requireWmsAuthentication,
} from "@/lib/server/wms-integration";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ externalEventId: string }> };

/** Creates or updates one WMS-owned event and its identified time slots. */
export async function PUT(request: Request, context: RouteContext) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;
  const contentTypeError = requireJsonContent(request);
  if (contentTypeError) return contentTypeError;

  const { externalEventId } = await context.params;
  if (!externalEventId.trim()) return jsonError("externalEventId is required.", 400);

  const body = await readJsonRecord(request);
  if (!body) return jsonError("A JSON object is required.", 400);

  const payload = parseWmsEventPayload(body, externalEventId);
  if (typeof payload === "string") return jsonError(payload, 422);

  try {
    const database = getIntegrationDatabase();
    const { data, error } = await database.rpc("upsert_wms_event", {
      p_external_event_id: payload.externalEventId,
      p_title: payload.title,
      p_event_date: payload.eventDate,
      p_location_name: payload.locationName,
      p_status: payload.status,
      p_description: payload.description,
      p_category: payload.category,
      p_location_url: payload.locationUrl,
      p_timeslots: payload.timeslots.map((slot) => ({
        external_timeslot_id: slot.externalTimeslotId,
        start_time: slot.startTime,
        end_time: slot.endTime,
        capacity: slot.capacity,
      })),
    }).single();

    if (error) {
      console.error("WMS event upsert failed:", error);
      return jsonError(error.message, integrationErrorStatus(error.code));
    }

    const event = data as { id: number };
    await logWmsAction(database, {
      action: payload.status === "Cancelled" ? "WMS_EVENT_CANCELLED" : "WMS_EVENT_PUBLISHED",
      entityType: "EVENT",
      entityId: event.id,
      entityLabel: payload.title,
      details: {
        external_event_id: payload.externalEventId,
        date: payload.eventDate,
        status: payload.status,
        category: payload.category,
        timeslots: payload.timeslots.map(slot => ({
          external_timeslot_id: slot.externalTimeslotId,
          start_time: slot.startTime,
          end_time: slot.endTime,
          capacity: slot.capacity,
        })),
      },
    });
    return Response.json({ eventId: event.id, externalEventId: payload.externalEventId });
  } catch (error) {
    console.error("WMS event integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
