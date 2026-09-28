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

const attendanceStatuses = new Set(["attended", "not_attended", "unknown"]);

/** Stores a WMS attendance outcome without creating clock times or volunteer hours. */
export async function POST(request: Request) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;
  const contentTypeError = requireJsonContent(request);
  if (contentTypeError) return contentTypeError;

  const body = await readJsonRecord(request);
  const bookingId = body ? parsePositiveInteger(body.vmsBookingId) : null;
  const attendanceStatus = typeof body?.attendanceStatus === "string" ? body.attendanceStatus.trim().toLowerCase() : "";
  const source = typeof body?.source === "string" ? body.source.trim().toLowerCase() : "";
  const recordedAt = typeof body?.recordedAt === "string" ? body.recordedAt : "";

  if (!bookingId || !attendanceStatuses.has(attendanceStatus) || source !== "wms" || Number.isNaN(Date.parse(recordedAt))) {
    return jsonError("vmsBookingId, attendanceStatus, source and recordedAt are required.", 422);
  }

  try {
    const database = getIntegrationDatabase();
    const { data, error } = await database.rpc("record_wms_attendance_outcome", {
      p_booking_id: bookingId,
      p_attendance_status: attendanceStatus,
      p_source: source,
      p_recorded_at: recordedAt,
    }).single();
    if (error) {
      console.error("WMS attendance update failed:", error);
      return jsonError(error.message, integrationErrorStatus(error.code));
    }

    const outcome = data as { booking_id: number; attendance_status: string; recorded_at: string };
    return Response.json({
      vmsBookingId: outcome.booking_id,
      attendanceStatus: outcome.attendance_status,
      recordedAt: outcome.recorded_at,
    });
  } catch (error) {
    console.error("WMS attendance integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
