/**
 * Checks the allowed avatar file type and size before an upload.
 * Canvas resizing belongs to presentation/profile/avatar-image.ts; storage calls belong to data/storage/.
 */

import { MAX_AVATAR_BYTES } from '@/data/storage/constants';
export { AVATAR_BUCKET, MAX_AVATAR_BYTES } from '@/data/storage/constants';
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Returns a user-facing size/type error or null. This is a client check, not a Storage policy. */
export function validateAvatarFile(file: Pick<File, "size" | "type">) {
  if (!ALLOWED_TYPES.includes(file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) return "Choose an image smaller than 2 MB.";
  return null;
}

