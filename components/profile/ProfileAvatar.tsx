"use client";
/**
 * Shows a saved account image or initials when no usable image is available.
 * The fallback keeps the account control readable while the photo URL is missing or fails.
 */

import Image from "next/image";
import { useState } from "react";
import styles from "@/components/profile/ProfilePhoto.module.css";

export default function ProfileAvatar({ name, src, size = 34 }: {
  name: string; src?: string | null; size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "V";
  return <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * .32 }}>
    {src && src !== failedUrl ? <Image src={src} alt={`${name}'s profile photo`} width={size} height={size} unoptimized onError={() => setFailedUrl(src)} /> : <span aria-label={`${name}'s initials`}>{initials}</span>}
  </span>;
}
