import { supabase } from '@/lib/supabase'
import type { VolunteerConsent } from '@/lib/types'

/** Retrieves the user's role and basic profile details for access checks and admin UI. */
export async function fetchUserRole(userId: string) {
  return supabase.from('profiles').select('role, full_name, email').eq('id', userId).single()
}

/** Saves editable volunteer details without allowing a volunteer to alter their role. */
export async function updateVolunteerProfile(userId: string, data: { full_name: string; date_of_birth: string }) {
  return supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single()
}

/** Starts Supabase's verified email-address change flow. */
export async function requestVolunteerEmailChange(email: string) {
  return supabase.auth.updateUser({ email })
}

/** Loads the volunteer's current consent record, if one has been completed. */
export async function fetchVolunteerConsent(): Promise<{ data: VolunteerConsent | null; error: { message: string; code?: string } | null }> {
  const result = await supabase.from('volunteer_consents').select('*').maybeSingle()
  return { data: result.data as VolunteerConsent | null, error: result.error }
}

/** Records the required onboarding confirmations for the current volunteer. */
export async function saveVolunteerConsent(consentVersion: string) {
  return supabase
    .from('volunteer_consents')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      code_of_conduct_accepted: true,
      data_use_accepted: true,
      information_accuracy_accepted: true,
      consent_version: consentVersion,
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
}
