/** Apply the account/input rules before making the admin address-search request. */
import { getAccountSession } from '@/data/auth/session';
import { requestPortalLocations } from '@/data/locations/portal';

export async function searchAdminLocations(query: string) {
  if (query.trim().length < 3 || query.length > 140) throw new Error('Enter a search between 3 and 140 characters.');
  const { data, error } = await getAccountSession();
  if (error || !data.session) throw new Error('Please sign in again before searching for a location.');
  const { ok, payload } = await requestPortalLocations(query, data.session.access_token);
  if (!ok) throw new Error(payload.error || 'Location search is unavailable.');
  return payload.results ?? [];
}
