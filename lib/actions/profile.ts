import { supabase } from '@/lib/supabase'
import { AVATAR_BUCKET, MAX_AVATAR_BYTES } from '@/lib/avatar'
import type { Profile, VolunteerConsent } from '@/lib/types'

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

function photoSaveMessage(error: unknown) {
  const details = error && typeof error === 'object' ? error as { code?: string; message?: string; statusCode?: string } : {};
  const message = details.message?.toLowerCase() ?? '';
  if (['42703', 'PGRST204', '42P01'].includes(details.code ?? '') || message.includes('bucket not found')) {
    return 'Profile-photo storage has not been set up yet. Ask an administrator to enable profile photos, then try saving again.';
  }
  if (details.code === '42501' || message.includes('row-level security') || message.includes('unauthorized')) {
    return 'Your account does not have permission to save this photo. Ask an administrator to check profile-photo access.';
  }
  if (message.includes('valid profile photo')) return details.message!;
  return 'Your photo could not be saved. Check your connection and try again. Your previous photo has not been replaced.';
}

/** Check the schema before uploading; keep the old photo until its replacement is saved. */
export async function saveVolunteerAvatar(userId: string, photo: Blob | null) {
  let uploadedPath: string | null = null;
  let profileSaved = false;
  try {
    const { data: current, error: readError } = await supabase.from('profiles')
      .select('avatar_path').eq('id', userId).single<Pick<Profile, 'avatar_path'>>();
    if (readError || !current) throw readError ?? new Error('Profile not found.');
    const previousPath = current.avatar_path;
    if (photo) {
      if (photo.type !== 'image/webp' || photo.size > MAX_AVATAR_BYTES || photo.size === 0) {
        throw new Error('Choose a valid profile photo smaller than 2 MB.');
      }
      uploadedPath = `${userId}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(uploadedPath, photo, {
        contentType: 'image/webp', cacheControl: '3600', upsert: false,
      });
      if (error) throw error;
    }
    const { data, error } = await supabase.from('profiles')
      .update({ avatar_path: uploadedPath }).eq('id', userId).select().single<Profile>();
    if (error || !data) throw error ?? new Error('Profile not found.');
    profileSaved = true;
    if (previousPath?.startsWith(`${userId}/`)) {
      try { await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]); } catch { /* Cleanup must not turn a successful save into an error. */ }
    }
    return { data, error: null };
  } catch (error) {
    if (uploadedPath && !profileSaved) {
      try { await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]); } catch { /* Preserve the original failure. */ }
    }
    return { data: null, error: photoSaveMessage(error) };
  }
}
