import { getAuthenticatedUser, updateAuthenticatedUser } from '@/business/shared/auth/session';
/**
 * Handles shared profile, onboarding consent and avatar persistence.
 * Auth email changes and profile fields use different operations; avatar updates keep storage
 * and profile paths in sync.
 */

import { MAX_AVATAR_BYTES } from '@/data/storage/constants'
import { createAvatarUrl, uploadAvatar, removeAvatars } from '@/data/storage/avatars'
import { readProfileRole, updateProfileDetails, readVolunteerConsent, storeVolunteerConsent, readAvatarPath, storeAvatarPath } from '@/data/profiles/repository'
import type { VolunteerConsent } from '@/business/shared/types'
import { corporateRolloutEnabled } from '@/business/shared/config/features'
import { isValidPhone, normalisePhone } from '@/business/shared/validation/contact-details'

/** Retrieves the user's role and basic profile details for access checks and admin UI. */
export async function fetchUserRole(userId: string) {
  return readProfileRole(userId)
}

/** Updates name/date of birth for the supplied user ID. The caller passes only editable fields;
 * database policies must still prevent updates to other users or protected fields. */
export async function updateVolunteerProfile(userId: string, data: { full_name: string; date_of_birth: string; phone?: string }) {
  const editable: { full_name: string; date_of_birth: string; phone?: string | null } = { full_name: data.full_name.trim(), date_of_birth: data.date_of_birth };
  if (!editable.full_name) return { data: null, error: { message: 'Enter your full name.' } };
  if (corporateRolloutEnabled) {
    const phone = normalisePhone(data.phone ?? '');
    if (phone && !isValidPhone(phone)) return { data: null, error: { message: 'Enter a valid cellphone number or leave it blank.' } };
    // The database stores an omitted/cleared optional number as NULL, not an invalid empty string.
    editable.phone = phone || null;
  }
  return updateProfileDetails(userId, editable)
}

/** Starts Supabase's verified email-address change flow. */
export async function requestVolunteerEmailChange(email: string) {
  return updateAuthenticatedUser({ email })
}

/** Loads at most one visible consent record. This query relies on RLS to limit it to the current user. */
export async function fetchVolunteerConsent(): Promise<{ data: VolunteerConsent | null; error: { message: string; code?: string } | null }> {
  const result = await readVolunteerConsent()
  return { data: result.data as VolunteerConsent | null, error: result.error }
}

/** Records the required onboarding confirmations for the current volunteer. */
export async function saveVolunteerConsent(consentVersion: string) {
  // The business action chooses the accepted policy/version; the repository owns the upsert.
  return storeVolunteerConsent((await getAuthenticatedUser()).data.user?.id, consentVersion, new Date().toISOString())
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

/** Both portals have an own-user profile row. Sharing photo storage does not grant
 * volunteer membership or expose another account's data; RLS still applies. */
export async function fetchProfileAvatar(userId: string): Promise<string | null> {
  const { data, error } = await readAvatarPath(userId);
  if (error || !data) throw new Error('Your saved image could not be loaded. Please retry.');
  return data.avatar_path ?? null;
}

/** Uploads a newly prepared photo before changing the profile, preserving the old photo on failure. */
export async function saveProfileAvatar(userId: string, photo: Blob | null) {
  let uploadedPath: string | null = null;
  let profileSaved = false;
  try {
    const { data: current, error: readError } = await readAvatarPath(userId);
    if (readError || !current) throw readError ?? new Error('Profile not found.');
    const previousPath = current.avatar_path;

    if (photo) {
      if (photo.type !== 'image/webp' || photo.size === 0 || photo.size > MAX_AVATAR_BYTES) {
        throw new Error('Choose a valid profile photo smaller than 2 MB.');
      }
      uploadedPath = `${userId}/${crypto.randomUUID()}.webp`;
      // A new path avoids overwriting the previous image before the profile update has succeeded.
      const { error } = await uploadAvatar(uploadedPath, photo);
      if (error) throw error;
    }

    const { data, error } = await storeAvatarPath(userId, uploadedPath);
    if (error || !data) throw error ?? new Error('Profile not found.');
    profileSaved = true;

    if (previousPath?.startsWith(`${userId}/`)) {
      // Only remove files in this user's folder. Removing a photo uses a null profile path.
      try { await removeAvatars([previousPath]); } catch { /* Cleanup must not undo a saved photo. */ }
    }
    return { data, error: null };
  } catch (error) {
    if (uploadedPath && !profileSaved) {
      // Compensating cleanup, not a transaction: Storage and the profile are separate writes.
      try { await removeAvatars([uploadedPath]); } catch { /* Preserve the original error. */ }
    }
    return { data: null, error: photoSaveMessage(error) };
  }
}

// Keep the existing volunteer call site while corporate uses the same safe upload implementation.
export const saveVolunteerAvatar = saveProfileAvatar;

/** The UI receives a signed URL, never a Storage client or a public bucket permission. */
export const loadProfilePhotoUrl = createAvatarUrl;
