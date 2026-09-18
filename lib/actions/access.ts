import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';

export function accessError(error: { code?: string; message: string }) {
  return error.code === 'PGRST202' || error.code === '42883'
    ? 'Administrator access management is not available yet. The DBA must review and apply the new admin access / fixed identity migration, then refresh the API schema cache. Do not rerun the CSR migration.'
    : error.message;
}
export async function searchAccessProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('search_admin_access_profiles', { p_query: query.trim() });
  if (error) throw new Error(accessError(error));
  return data as Profile[];
}
export async function changeAdminAccess(targetId: string, role: UserRole) {
  const { error } = await supabase.rpc('set_profile_admin_access', { p_target_id: targetId, p_role: role });
  if (error) throw new Error(accessError(error));
}
export async function currentAccessUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'Please sign in again.');
  return data.user.id;
}
