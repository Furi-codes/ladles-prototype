import { createWmsRepository } from '@/data/wms/repository';
/**
 * Creates or updates a volunteer event published from WMS.
 * Shared parsers validate the payload and the database operation preserves the external
 * event/timeslot identities.
 */

import {
  integrationErrorStatus,
  jsonError,
  parseWmsEventPayload,
  readJsonRecord,
  requireJsonContent,
  requireWmsAuthentication,
} from "@/data/server/wms-integration";



/** Next.js supplies dynamic route parameters as a promise, so the handler awaits them. */
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
    const repository = createWmsRepository();
    // The database function owns the save rules. This route maps camelCase JSON to its SQL parameters.
    const { data, error } = await repository.publishEvent(payload);

    if (error) {
      console.error("WMS event upsert failed:", error);
      return jsonError(error.message, integrationErrorStatus(error.code));
    }

    const event = data as { id: number };
    // Log only after the write succeeds. The logger does not fail the response if logging fails.
    await repository.logAction({
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
    // This broad catch also reports unexpected runtime failures as configuration errors.
    console.error("WMS event integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
