import { supabase } from '@/lib/supabase'

/** Retrieves the user's role and basic profile details for access checks and admin UI. */
export async function fetchUserRole(userId: string) {
  return supabase.from('profiles').select('role, full_name, email').eq('id', userId).single()
}
