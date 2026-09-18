export const AVATAR_BUCKET = "volunteer-avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateAvatarFile(file: Pick<File, "size" | "type">) {
  if (!ALLOWED_TYPES.includes(file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) return "Choose an image smaller than 2 MB.";
  return null;
}

/** Decode and re-encode a centred square, removing original image metadata. */
export async function prepareAvatar(file: File): Promise<Blob> {
  const error = validateAvatarFile(file);
  if (error) throw new Error(error);
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 64 || bitmap.height < 64) throw new Error("Choose an image at least 64 by 64 pixels.");
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error("This image is too large. Choose a smaller photo.");
    const side = Math.min(bitmap.width, bitmap.height);
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
    bitmap.close();
  }
}
