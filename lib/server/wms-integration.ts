import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

type JsonRecord = Record<string, unknown>;

export type WmsTimeslot = {
  externalTimeslotId: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

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

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
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

export async function readJsonRecord(request: Request): Promise<JsonRecord | null> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseWmsEventPayload(value: JsonRecord, externalEventId: string): WmsEventPayload | string {
  const payloadExternalId = requiredString(value.externalEventId);
  if (!payloadExternalId || payloadExternalId !== externalEventId) {
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

export function parsePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value.trim() || null : null;
}

function requiredString(value: unknown): string | null {
  return optionalString(value);
}

function parseEventStatus(value: unknown): WmsEventPayload["status"] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return null;
}

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
      return null;
    }
    ids.add(externalTimeslotId);
    slots.push({ externalTimeslotId, startTime, endTime, capacity });
  }
  return slots;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

export function integrationErrorStatus(code?: string): number {
  if (code === "P0002") return 404;
  if (code === "P0001" || code === "23514" || code === "23505") return 409;
  return 500;
}
