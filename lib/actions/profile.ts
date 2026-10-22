/** Profile, consent and photo database calls made from volunteer components and their provider. */
import { supabase } from '@/lib/supabase'
import { AVATAR_BUCKET, MAX_AVATAR_BYTES } from '@/lib/avatar'
import type { Profile, VolunteerConsent } from '@/lib/types'
import { corporateRolloutEnabled } from '@/lib/feature-flags'
import { isValidPhone, normalisePhone } from '@/lib/contact-details'

/** Retrieves the user's role and basic profile details for access checks and admin UI. */
export async function fetchUserRole(userId: string) {
  return supabase.from('profiles').select('role, full_name, email').eq('id', userId).single()
}

/** Updates name/date of birth for the supplied user ID. The caller passes only editable fields;
 * database policies must still prevent updates to other users or protected fields. */
export async function updateVolunteerProfile(userId: string, data: { full_name: string; date_of_birth: string; phone?: string }) {
  const editable: { full_name: string; date_of_birth: string; phone?: string } = { full_name: data.full_name.trim(), date_of_birth: data.date_of_birth };
  if (!editable.full_name) return { data: null, error: { message: 'Enter your full name.' } };
  if (corporateRolloutEnabled) {
    const phone = normalisePhone(data.phone ?? '');
    if (!isValidPhone(phone)) return { data: null, error: { message: 'Enter a valid cellphone number.' } };
    editable.phone = phone;
  }
  return supabase
    .from('profiles')
    .update(editable)
    .eq('id', userId)
    .select()
    .single()
}

/** Starts Supabase's verified email-address change flow. */
export async function requestVolunteerEmailChange(email: string) {
  return supabase.auth.updateUser({ email })
}

/** Loads at most one visible consent record. This query relies on RLS to limit it to the current user. */
export async function fetchVolunteerConsent(): Promise<{ data: VolunteerConsent | null; error: { message: string; code?: string } | null }> {
  const result = await supabase.from('volunteer_consents').select('*').maybeSingle()
  return { data: result.data as VolunteerConsent | null, error: result.error }
}

/** Records the required onboarding confirmations for the current volunteer. */
export async function saveVolunteerConsent(consentVersion: string) {
  return supabase
    .from('volunteer_consents')
    // Upsert replaces the existing acceptance for this user instead of creating another row.
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

/** Turns setup/permission failures into messages the photo editor can show without raw storage errors. */
function photoSaveMessage(error: unknown) {
  const details = error && typeof error === 'object' ? error as { code?: string; message?: string } : {};
  const message = details.message?.toLowerCase() ?? '';
  if (['42703', 'PGRST204', '42P01'].includes(details.code ?? '') || message.includes('bucket not found')) {
    return 'Profile-photo storage has not been set up yet. Ask an administrator to enable profile photos, then try saving again.';
  }
  if (details.code === '42501' || message.includes('row-level security') || message.includes('unauthorized')) {
    return 'Your account does not have permission to save this photo. Ask an administrator to check profile-photo access.';
  }
  return 'Your photo could not be saved. Check your connection and try again. Your previous photo has not been replaced.';
}

/** Uploads a newly prepared photo before changing the profile, preserving the old photo on failure. */
export async function saveVolunteerAvatar(userId: string, photo: Blob | null) {
  let uploadedPath: string | null = null;
  let profileSaved = false;
  try {
    const { data: current, error: readError } = await supabase.from('profiles')
      .select('avatar_path').eq('id', userId).single<Pick<Profile, 'avatar_path'>>();
    if (readError || !current) throw readError ?? new Error('Profile not found.');
    const previousPath = current.avatar_path;

    if (photo) {
      if (photo.type !== 'image/webp' || photo.size === 0 || photo.size > MAX_AVATAR_BYTES) {
        throw new Error('Choose a valid profile photo smaller than 2 MB.');
      }
      uploadedPath = `${userId}/${crypto.randomUUID()}.webp`;
      // A new path avoids overwriting the previous image before the profile update has succeeded.
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
      // Only remove files in this user's folder. Removing a photo uses a null profile path.
      try { await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]); } catch { /* Cleanup must not undo a saved photo. */ }
    }
    return { data, error: null };
  } catch (error) {
    if (uploadedPath && !profileSaved) {
      // Compensating cleanup, not a transaction: Storage and the profile are separate writes.
      try { await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]); } catch { /* Preserve the original error. */ }
    }
    return { data: null, error: photoSaveMessage(error) };
  }
}
