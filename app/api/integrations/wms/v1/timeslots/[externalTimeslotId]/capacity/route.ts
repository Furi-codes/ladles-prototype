import {
  getIntegrationDatabase,
  integrationErrorStatus,
  jsonError,
  parsePositiveInteger,
  readJsonRecord,
  requireJsonContent,
  requireWmsAuthentication,
} from "@/lib/server/wms-integration";

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
    const { data, error } = await database.rpc("update_wms_timeslot_capacity", {
      p_external_timeslot_id: externalTimeslotId,
      p_capacity: capacity,
    }).single();
    if (error) {
      console.error("WMS capacity update failed:", error);
      return jsonError(error.message, integrationErrorStatus(error.code));
    }

    const slot = data as { id: number; capacity: number };
    return Response.json({ vmsTimeslotId: slot.id, externalTimeslotId, capacity: slot.capacity });
  } catch (error) {
    console.error("WMS capacity integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
