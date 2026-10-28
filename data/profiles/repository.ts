/** Profile/consent persistence. The database still checks ownership; these methods do not grant access. */
import { supabase } from '@/data/supabase/client';
import type { Profile } from '@/business/shared/types';

export const findSignInProfile = (userId: string) => supabase.from('profiles').select('role').eq('id', userId).single();
export const readProfileRole = (userId: string) => supabase.from('profiles').select('role, full_name, email').eq('id', userId).single();
export const updateProfileDetails = (userId: string, fields: { full_name: string; date_of_birth: string; phone?: string | null }) =>
  supabase.from('profiles').update(fields).eq('id', userId).select().single();
export const readVolunteerConsent = () => supabase.from('volunteer_consents').select('*').maybeSingle();
export const storeVolunteerConsent = (userId: string | undefined, version: string, acceptedAt: string) => supabase.from('volunteer_consents').upsert({
  user_id: userId, code_of_conduct_accepted: true, data_use_accepted: true,
  information_accuracy_accepted: true, consent_version: version, accepted_at: acceptedAt,
}, { onConflict: 'user_id' }).select().single();
export const readAvatarPath = (userId: string) => supabase.from('profiles').select('avatar_path').eq('id', userId).single<Pick<Profile, 'avatar_path'>>();
export const storeAvatarPath = (userId: string, avatarPath: string | null) => supabase.from('profiles').update({ avatar_path: avatarPath }).eq('id', userId).select().single<Profile>();
