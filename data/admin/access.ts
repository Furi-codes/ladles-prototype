/**
 * Calls the protected profile-search and administrator-access operations.
 * The browser supplies the requested change, but the database decides whether the current admin
 * may make it.
 */

import { supabase } from '@/data/supabase/client';
import type { Profile, UserRole } from '@/business/shared/types';

/** Explains a missing RPC separately from other database errors, which keep their original message. */
export function accessError(error: { code?: string; message: string }) {
  return error.code === 'PGRST202' || error.code === '42883'
    ? 'Administrator access management is temporarily unavailable. Please try again later.'
    : error.message;
}
/** Sends a trimmed search term to the protected profile search RPC, or throws its error. */
export async function searchAccessProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('search_admin_access_profiles', { p_query: query.trim() });
  if (error) throw new Error(accessError(error));
  return data as Profile[];
}
/** Requests a role change for one profile; successful completion returns no record. */
export async function changeAdminAccess(targetId: string, role: UserRole) {
  const { error } = await supabase.rpc('set_profile_admin_access', { p_target_id: targetId, p_role: role });
  if (error) throw new Error(accessError(error));
}
/** Gets the signed-in user's ID for the access screen, and rejects an absent/failed Auth lookup. */
export async function currentAccessUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'Please sign in again.');
  return data.user.id;
}
