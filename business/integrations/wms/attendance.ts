import { createWmsRepository } from '@/data/wms/repository';
/**
 * Accepts WMS attendance updates for synced volunteer bookings.
 * Shared server authentication and payload checks run before the protected database operation.
 */

import {
  integrationErrorStatus,
  jsonError,
  parsePositiveInteger,
  readJsonRecord,
  requireJsonContent,
  requireWmsAuthentication,
} from "@/data/server/wms-integration";



/** Only these external attendance outcomes are accepted by this endpoint. */
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
    // An outcome needs a booking, supported status, WMS source and parseable timestamp before SQL is called.
    return jsonError("vmsBookingId, attendanceStatus, source and recordedAt are required.", 422);
  }

  try {
    const repository = createWmsRepository();
    const { data, error } = await repository.saveAttendance(bookingId, attendanceStatus, source, recordedAt);
    if (error) {
      console.error("WMS attendance update failed:", error);
      return jsonError(error.message, integrationErrorStatus(error.code));
    }

    const outcome = data as { booking_id: number; attendance_status: string; recorded_at: string };
    // Return the saved RPC result rather than assuming the request values were accepted unchanged.
    await repository.logAction({
      action: "WMS_ATTENDANCE_UPDATED",
      entityType: "BOOKING",
      entityId: outcome.booking_id,
      entityLabel: `Booking ${outcome.booking_id}`,
      details: { attendance_status: outcome.attendance_status, recorded_at: outcome.recorded_at },
    });
    return Response.json({
      vmsBookingId: outcome.booking_id,
      attendanceStatus: outcome.attendance_status,
      recordedAt: outcome.recorded_at,
    });
  } catch (error) {
    // This catch groups unexpected runtime failures with configuration failures.
    console.error("WMS attendance integration configuration failed:", error);
    return jsonError("Integration is not configured.", 503);
  }
}
