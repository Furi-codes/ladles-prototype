"use client";
/**
 * Lets the company preview, save or remove its account image.
 * The same file preparation rules used for profile photos also apply to company images.
 */

import { userFacingError } from '@/lib/errors/user-facing';

import { useEffect, useRef, useState } from 'react';
import { prepareAvatar } from '@/lib/storage/avatar';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import { useCorporateWorkspace } from '@/features/corporate/shell/CorporateWorkspaceProvider';
import photoStyles from '@/components/profile/ProfilePhoto.module.css';
import styles from '@/styles/volunteer.module.css';
import ui from '@/styles/corporate.module.css';

/** Reuse the photo preparation and visual styles, but save through the corporate workspace. */
export default function CorporatePhotoEditor({ onActivityChange }: { onActivityChange?: (active: boolean) => void } = {}) {
  const { data, photo } = useCorporateWorkspace();
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  const [accepted, setAccepted] = useState(false), [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null), locked = useRef(false), generation = useRef(0);
  const busy = preparing || photo.saving;
  useUnsavedChanges(Boolean(draft) || busy);
  useEffect(() => { onActivityChange?.(Boolean(draft) || busy); }, [draft, busy, onActivityChange]);
  useEffect(() => () => { onActivityChange?.(false); }, [onActivityChange]);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);
  useEffect(() => () => { ++generation.current; }, []);
  async function choose(file?: File) {
    if (!file || locked.current || photo.saving) return;
    const request = ++generation.current;
    locked.current = true; setPreparing(true); setError(''); setMessage('');
    try {
      const blob = await prepareAvatar(file);
      if (request === generation.current) { setDraft({ blob, url: URL.createObjectURL(blob) }); setAccepted(false); }
    } catch (failure) {
      if (request === generation.current) setError(userFacingError(failure instanceof Error ? failure.message : 'This image could not be opened. Please choose another.', "This image could not be opened. Please choose another."));
    } finally { if (request === generation.current) { locked.current = false; setPreparing(false); } }
  }
  async function save(remove = false) {
    if (locked.current || busy || !remove && (!draft || !accepted)) return;
    if (remove && !window.confirm('Remove your company image? Your initials will be shown instead.')) return;
    locked.current = true; setError(''); setMessage('');
    const request = ++generation.current;
    try {
      const failure = await photo.save(remove ? null : draft!.blob);
      if (request !== generation.current) return;
      if (failure) setError(userFacingError(failure, "This action could not be completed. Please refresh and try again."));
      else { setDraft(null); setAccepted(false); setMessage(userFacingError(remove ? 'Company image removed.' : 'Company image updated.', "This action could not be completed. Please refresh and try again.")); }
    } catch { if (request === generation.current) setError('Your image could not be saved. Please retry.'); }
    finally { if (request === generation.current) locked.current = false; }
  }
  return <section className={styles.card} aria-labelledby="corporate-image-title">
    <div className={styles.cardHeader}><div><h2 id="corporate-image-title" className={styles.cardTitle}>Company image</h2><p className={styles.cardHint}>Add a logo or profile photo for your account icon.</p></div></div>
    <div className={photoStyles.editor}>
      <div className={photoStyles.previewRow}>
        <ProfileAvatar name={data?.account.company_name || 'Company'} src={draft?.url ?? photo.avatarUrl} size={96} />
        <div><p className={photoStyles.previewLabel}>{draft ? 'Preview before saving' : 'Your company image'}</p><p className={styles.cardHint}>JPG, PNG or WebP, up to 2 MB. Preview the circular crop before saving.</p>
          <input ref={input} className={photoStyles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a company image" disabled={busy || photo.loading} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
          <button type="button" className={styles.secondaryButton} disabled={busy || photo.loading} onClick={() => input.current?.click()}>{preparing ? 'Preparing image…' : 'Choose image'}</button>
        </div>
      </div>
      {draft && <label className={photoStyles.acknowledgement}><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /><span>I have permission to use this image.</span></label>}
      {photo.loading && <p className={styles.cardHint} role="status">Loading saved image…</p>}
      {photo.error && <div className={ui.imageFeedback} role="alert">{photo.error}<button type="button" className={styles.secondaryButton} disabled={busy || photo.loading} onClick={() => void photo.reload()}>Retry</button></div>}
      {error && <p className={styles.messageError} role="alert">{error}</p>}
      {message && <p className={ui.imageFeedback} role="status">{message}</p>}
      <div className={ui.formFooter}>
        {draft ? <><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => { setDraft(null); setAccepted(false); setError(''); }}>Discard</button><button type="button" className={styles.primaryButton} disabled={busy || !accepted} onClick={() => void save()}>{photo.saving ? 'Saving…' : 'Save image'}</button></> : photo.path && <button type="button" className={styles.secondaryButton} disabled={busy || photo.loading} onClick={() => void save(true)}>{photo.saving ? 'Removing…' : 'Remove image'}</button>}
      </div>
    </div>
  </section>;
}
