"use client";

import { useEffect, useRef, useState } from "react";
import { prepareAvatar } from "@/lib/avatar";
import { useVolunteerData } from "./VolunteerProvider";
import ProfileAvatar from "./ProfileAvatar";
import styles from "./ProfilePhoto.module.css";
import shared from "../volunteer.module.css";

type Draft = { blob: Blob; url: string };

export default function ProfilePhotoEditor() {
  const { profile, avatarUrl, saveAvatar } = useVolunteerData();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  async function choosePhoto(file?: File) {
    if (!file || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const blob = await prepareAvatar(file);
      setDraft({ blob, url: URL.createObjectURL(blob) });
      setAccepted(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "This image could not be opened. Choose another photo.");
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  async function save(remove = false) {
    if (locked.current || (!remove && (!draft || !accepted))) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const error = await saveAvatar(remove ? null : draft!.blob);
      if (error) setError(error);
      else { setDraft(null); setAccepted(false); }
    } catch {
      setError("Your photo could not be saved. Please try again.");
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  return <section className={shared.card} aria-labelledby="profile-photo-title">
    <div className={shared.cardHeader}><div><h2 id="profile-photo-title" className={shared.cardTitle}>Profile photo</h2><p className={shared.cardHint}>Make your volunteer profile feel like you.</p></div></div>
    <div className={styles.editor}>
      <div className={styles.previewRow}>
        <ProfileAvatar name={profile?.full_name || "Volunteer"} src={draft?.url ?? avatarUrl} size={96} />
        <div><p className={styles.previewLabel}>{draft ? "Preview before saving" : "Your profile photo"}</p><p className={shared.cardHint}>JPG, PNG or WebP, up to 2 MB.<br />Your photo is cropped to a centred circle.</p>
          <input ref={fileInput} className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" disabled={busy} onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ""; }} />
          <button type="button" className={shared.secondaryButton} disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? "Please wait..." : "Choose photo"}</button>
        </div>
      </div>
      <div className={styles.guidance}><strong>A photo suitable for volunteering</strong><p>Choose a clear photo of yourself that you have permission to use. Keep it respectful: no explicit, hateful, violent, or offensive imagery.</p></div>
      {draft && <label className={styles.acknowledgement}><input type="checkbox" checked={accepted} disabled={busy} onChange={(event) => setAccepted(event.target.checked)} /><span>I confirm this photo follows the guidelines above.</span></label>}
      {error && <p className={shared.messageError} role="alert">{error}</p>}
      <div className={styles.actions}>
        {draft ? <><button type="button" className={shared.secondaryButton} disabled={busy} onClick={() => { setDraft(null); setAccepted(false); setError(null); }}>Discard</button><button type="button" className={shared.primaryButton} disabled={busy || !accepted} onClick={() => void save()}>{busy ? "Saving..." : "Save photo"}</button></> : profile?.avatar_path && <button type="button" className={shared.secondaryButton} disabled={busy} onClick={() => void save(true)}>{busy ? "Removing..." : "Remove photo"}</button>}
      </div>
    </div>
  </section>;
}
