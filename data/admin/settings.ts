/**
 * Loads the administrator list and saves the current admin's display name.
 * Account settings work independently of the old organisation-settings record.
 */

import { supabase } from '@/data/supabase/client';
import { fetchAllPages } from '@/data/supabase/pagination';
import type { Profile } from '@/business/shared/types';

/** The current settings screen needs the administrator list, not legacy organisation defaults. */
export async function loadSettings() {
  const admins = await fetchAllPages<Profile>((from, to) => supabase.from('profiles').select('id,full_name,email,role', { count: 'exact' }).eq('role', 'admin').order('full_name').order('id').range(from, to));
  if (admins.error) throw new Error(admins.error.message);
  return { admins: admins.data };
}

/** Update the authenticated account only; the form cannot supply another user's ID. */
export async function saveAdminName(name: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'Please sign in again.');
  const result = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', data.user.id).select().single();
  if (result.error) throw new Error(result.error.message);
}
