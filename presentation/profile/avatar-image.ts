/** Browser-only image preparation belongs to presentation; business code validates the upload policy. */
import { validateAvatarFile, MAX_AVATAR_BYTES } from '@/business/shared/storage/avatar';

/** Decode and re-encode a centred square, removing original image metadata. */
export async function prepareAvatar(file: File): Promise<Blob> {
  const error = validateAvatarFile(file);
  if (error) throw new Error(error);
  const bitmap = await createImageBitmap(file);
  try {
    // Check decoded dimensions as well as file size: a small compressed file can contain many pixels.
    if (bitmap.width < 64 || bitmap.height < 64) throw new Error("Choose an image at least 64 by 64 pixels.");
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("This image is too large. Choose a smaller photo.");
    const side = Math.min(bitmap.width, bitmap.height);
    // Use the centre square of the original image, then resize it to a consistent 512px photo.
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob?.type === "image/webp" && blob.size <= MAX_AVATAR_BYTES) resolve(blob);
      else reject(new Error("Your browser could not prepare this photo. Try another image or browser."));
    }, "image/webp", .85));
  } finally {
    // Release decoded image memory even when cropping or encoding fails.
    bitmap.close();
  }
}
