/** Shared validation, authentication and logging for WMS routes. Never import this into browser components. */
import "server-only";
import { userFacingError } from '@/lib/user-facing-error';

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

/** An object-shaped JSON body; each field still needs checking before use. */
type JsonRecord = Record<string, unknown>;

/** Normalised slot fields from the external system, before mapping them to database parameter names. */
export type WmsTimeslot = {
  externalTimeslotId: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

/** Accepted event publish data. External IDs identify the WMS records rather than VMS numeric IDs. */
export type WmsEventPayload = {
  externalEventId: string;
  title: string;
  eventDate: string;
  locationName: string;
  status: "Scheduled" | "Cancelled";
  description: string | null;
  category: "Dignity Kitchen" | "Warehouse HQ" | "Feed The Soil" | "Campaign / Special Event" | "Other";
  locationUrl: string | null;
  timeslots: WmsTimeslot[];
};

/** Keeps route failures in the same JSON error shape while preserving the chosen HTTP status. */
export function jsonError(message: string, status: number) {
  return Response.json({ error: userFacingError(message, 'The request could not be completed. Please try again.') }, { status });
}

/** Validates the private WMS bearer token before any database access occurs. */
export function requireWmsAuthentication(request: Request): Response | null {
  const expectedToken = process.env.WMS_INTEGRATION_TOKEN;
  if (!expectedToken) {
    console.error("WMS_INTEGRATION_TOKEN is not configured.");
    return jsonError("Integration is not configured.", 503);
  }

  const authorization = request.headers.get("authorization");
  const suppliedToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  // timingSafeEqual requires equal-length buffers. The guard avoids an exception for a wrong-length token.
  const isValid = expected.length === supplied.length && timingSafeEqual(expected, supplied);

  return isValid ? null : jsonError("Unauthorized.", 401);
}

/** Rejects write requests that are not sent as JSON under the shared contract. */
export function requireJsonContent(request: Request): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().startsWith("application/json")
    ? null
    : jsonError("Content-Type must be application/json.", 415);
}

/** Creates a server-only Supabase client. Its key must never use NEXT_PUBLIC_. */
export function getIntegrationDatabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("The integration database client is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** WMS action details with a fixed integration actor rather than a signed-in administrator. */
type WmsAuditAction = {
  action: "WMS_EVENT_PUBLISHED" | "WMS_EVENT_CANCELLED" | "WMS_CAPACITY_UPDATED" | "WMS_ATTENDANCE_UPDATED";
  entityType: "EVENT" | "EVENT_SLOT" | "BOOKING";
  entityId: number;
  entityLabel: string;
  details: Record<string, unknown>;
};

/** Server-only activity logging. An audit failure must not misreport a committed WMS write as failed. */
export async function logWmsAction(database: SupabaseClient, entry: WmsAuditAction): Promise<void> {
  try {
    const { error } = await database.from("admin_audit_log").insert({
      admin_id: null,
      admin_name: "WMS integration",
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: String(entry.entityId),
      entity_label: entry.entityLabel,
      details: { ...entry.details, source: "wms" },
    });
    if (error) console.error("Unable to record WMS activity:", error);
  } catch (error) {
    console.error("Unable to record WMS activity:", error);
  }
}

/** Reads an object body, returning null for malformed JSON, arrays or primitive values. */
export async function readJsonRecord(request: Request): Promise<JsonRecord | null> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

/** Validates/normalises a publish request, returning accepted fields or an error string for HTTP 422. */
export function parseWmsEventPayload(value: JsonRecord, externalEventId: string): WmsEventPayload | string {
  const payloadExternalId = requiredString(value.externalEventId);
  if (!payloadExternalId || payloadExternalId !== externalEventId) {
    // Do not let one URL accidentally update a different WMS event named in the body.
    return "externalEventId must match the URL.";
  }

  const title = requiredString(value.title);
  const eventDate = requiredString(value.eventDate);
  const locationName = requiredString(value.locationName);
  const status = parseEventStatus(value.status);
  const category = parseCategory(value.category);
  const description = optionalString(value.description);
  const locationUrl = optionalString(value.locationUrl);
  const timeslots = parseTimeslots(value.timeslots);

  if (!title || !eventDate || !locationName || !status || !category || !timeslots || !isIsoDate(eventDate)) {
    return "The event payload is incomplete or invalid.";
  }

  return { externalEventId, title, eventDate, locationName, status, category, description, locationUrl, timeslots };
}

/** Accepts positive JSON numbers only, not numeric strings, zero or fractional capacities/IDs. */
export function parsePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Trims text; missing, blank and non-string optional values become null. */
export function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value.trim() || null : null;
}

/** Uses the same trimming as optional text; callers reject the returned null for required fields. */
function requiredString(value: unknown): string | null {
  return optionalString(value);
}

/** Accepts supported status spellings and returns the portal's standard casing. */
function parseEventStatus(value: unknown): WmsEventPayload["status"] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return null;
}

/** Maps recognised WMS programme names to portal categories, rejecting unknown names. */
function parseCategory(value: unknown): WmsEventPayload["category"] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const categories: Record<string, WmsEventPayload["category"]> = {
    warehouse: "Warehouse HQ",
    warehouse_hq: "Warehouse HQ",
    "warehouse hq": "Warehouse HQ",
    dignity_kitchen: "Dignity Kitchen",
    "dignity kitchen": "Dignity Kitchen",
    feed_the_soil: "Feed The Soil",
    "feed the soil": "Feed The Soil",
    campaign: "Campaign / Special Event",
    "campaign / special event": "Campaign / Special Event",
    other: "Other",
  };
  return categories[normalized] ?? null;
}

/** Validates every supplied slot. The array can be empty; each supplied ID must be unique. */
function parseTimeslots(value: unknown): WmsTimeslot[] | null {
  if (!Array.isArray(value)) return null;

  const slots: WmsTimeslot[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const externalTimeslotId = requiredString(entry.externalTimeslotId);
    const startTime = requiredString(entry.startTime);
    const endTime = requiredString(entry.endTime);
    const capacity = parsePositiveInteger(entry.capacity);
    if (!externalTimeslotId || !startTime || !endTime || !capacity) {
      return null;
    }
    if (!isTime(startTime) || !isTime(endTime) || startTime >= endTime || ids.has(externalTimeslotId)) {
      // API times allow minutes/optional seconds; they are not restricted to the form's 15-minute choices.
      // Reject start strings at/after end strings; formats are not normalised and overlaps are not checked here.
      return null;
    }
    ids.add(externalTimeslotId);
    slots.push({ externalTimeslotId, startTime, endTime, capacity });
  }
  return slots;
}

/** Narrows unknown JSON to a non-null object, excluding arrays. */
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks YYYY-MM-DD shape and Date.parse acceptance; it is not a strict calendar round-trip check. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Accepts 24-hour HH:MM or HH:MM:SS within the numeric hour/minute/second limits. */
function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

/** Maps known missing-record errors to 404, rule/constraint conflicts to 409 and other SQL errors to 500. */
export function integrationErrorStatus(code?: string): number {
  if (code === "P0002") return 404;
  if (code === "P0001" || code === "23514" || code === "23505") return 409;
  return 500;
}
