/**
 * Provides the authenticated admin address-search endpoint.
 * The role is checked before cache access or an external lookup. The bounded search queue is per
 * server instance, not a global rate limiter.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from '@/lib/server/admin-auth';

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

const cachedResults = new Map<string, { expiresAt: number; results: unknown[] }>();
let nextSearchAt = 0;

/**
 * A deliberately rate-limited, admin-only address lookup proxy.
 * Searches occur only when an administrator presses Search; this is not an
 * autocomplete service. Results are limited to South Africa and are cached.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ error: "Enter at least three characters to search." }, { status: 400 });
  }
  if (query.length > 140) {
    return NextResponse.json({ error: "Please use a shorter address search." }, { status: 400 });
  }

  const cacheKey = query.toLocaleLowerCase();
  const cached = cachedResults.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ results: cached.results }, { headers: { 'Cache-Control': 'private, no-store' } });

  // Reserve a slot before waiting, so simultaneous requests do not all run together.
  const waitFor = Math.max(0, nextSearchAt - Date.now());
  if (waitFor > 3300) return NextResponse.json({ error: 'Location search is busy. Please try again shortly.' }, { status: 429, headers: { 'Retry-After': '4' } });
  nextSearchAt = Date.now() + waitFor + 1100;
  if (waitFor) await new Promise((resolve) => setTimeout(resolve, waitFor));

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "za");
  url.searchParams.set("limit", "5");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "LadlesOfLoveVolunteerPortal/1.0 (admin location lookup)",
        "Accept-Language": "en-ZA,en;q=0.9",
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

    const payload = await response.json() as NominatimResult[];
    const results = payload
      .filter((result) => result.display_name && result.lat && result.lon)
      .map((result) => ({
        label: result.display_name as string,
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.lat},${result.lon}`)}`,
      }));

    for (const [key, entry] of cachedResults) if (entry.expiresAt <= Date.now()) cachedResults.delete(key);
    if (cachedResults.size >= 256) cachedResults.delete(cachedResults.keys().next().value!);
    cachedResults.set(cacheKey, { expiresAt: Date.now() + 86_400_000, results });
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: "Location search is temporarily unavailable. You can still enter the address manually." }, { status: 502 });
  }
}
