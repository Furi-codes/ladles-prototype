/** External geocoding transport. Business code decides who can search and when to reuse a cached result. */
export async function fetchLocationResults(query: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query); url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1'); url.searchParams.set('countrycodes', 'za'); url.searchParams.set('limit', '5');
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000), next: { revalidate: 86_400 },
    headers: { 'User-Agent': 'LadlesOfLoveVolunteerPortal/1.0 (admin location lookup)', 'Accept-Language': 'en-ZA,en;q=0.9' },
  });
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
  return response.json() as Promise<{ display_name?: string; lat?: string; lon?: string }[]>;
}
