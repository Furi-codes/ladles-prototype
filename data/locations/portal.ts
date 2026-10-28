/** The browser's authenticated request to our location endpoint, separate from the server geocoder adapter. */
export async function requestPortalLocations(query: string, token: string) {
  const response = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
  return { ok: response.ok, payload: await response.json() as { results?: { label: string; mapUrl: string }[]; error?: string } };
}
