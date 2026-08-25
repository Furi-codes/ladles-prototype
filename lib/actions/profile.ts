import { supabase } from '@/lib/supabase'

/** Retrieves only the user's role for route-access checks. */
export async function fetchUserRole(userId: string) {
  return supabase.from('profiles').select('role').eq('id', userId).single()
}
