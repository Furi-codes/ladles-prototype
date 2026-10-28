/** Storage requests live here, so profile workflows do not construct SDK upload/delete requests. */
import { supabase } from '@/data/supabase/client';
import { AVATAR_BUCKET } from './constants';

export const uploadAvatar = (path: string, photo: Blob) => supabase.storage.from(AVATAR_BUCKET).upload(path, photo, {
  contentType: 'image/webp', cacheControl: '3600', upsert: false,
});
export const removeAvatars = (paths: string[]) => supabase.storage.from(AVATAR_BUCKET).remove(paths);
export const createAvatarUrl = (path: string) => supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);
