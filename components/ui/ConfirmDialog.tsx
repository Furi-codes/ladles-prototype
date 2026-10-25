"use client";
/**
 * Shows a confirmation before the caller performs an important action.
 * The dialog calls the supplied confirm/cancel handlers; it does not perform the database write
 * itself.
 */

import { useRef } from 'react';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import styles from "@/styles/volunteer.module.css";

export default function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm, busy = false, error = '' }: { title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; error?: string }) {
  const panel=useRef<HTMLElement>(null);
  useDialogFocus(true,panel,onCancel,busy);
  return <div className={styles.backdrop} role="presentation"><section ref={panel} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"><h2 id="confirm-dialog-title" className={styles.cardTitle}>{title}</h2><p className={styles.cardHint} style={{ marginTop: 9, fontSize: 14 }}>{message}</p>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" disabled={busy} className={styles.secondaryButton} onClick={onCancel}>Cancel</button><button type="button" disabled={busy} className={styles.primaryButton} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}
