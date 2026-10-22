import styles from "../volunteer.module.css";

export default function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"><h2 id="confirm-dialog-title" className={styles.cardTitle}>{title}</h2><p className={styles.cardHint} style={{ marginTop: 9, fontSize: 14 }}>{message}</p><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onCancel}>Cancel</button><button type="button" className={styles.primaryButton} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}
