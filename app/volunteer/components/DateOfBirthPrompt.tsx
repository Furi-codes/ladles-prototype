"use client";

import { useState } from "react";
import styles from "../volunteer.module.css";

export default function DateOfBirthPrompt({ onSave }: { onSave: (dateOfBirth: string) => Promise<string | null> }) {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    const saveError = await onSave(dateOfBirth);
    setIsSaving(false);
    setError(saveError);
  }

  return <div className={styles.backdrop}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dob-prompt-title"><h2 id="dob-prompt-title" className={styles.cardTitle}>Complete your volunteer profile</h2><p className={styles.cardHint} style={{ marginTop: 9, fontSize: 14 }}>Please add your date of birth before continuing. It is used only for volunteer eligibility and anonymous reporting.</p><form onSubmit={submit}><div className={styles.field}><label className={styles.fieldLabel} htmlFor="date-of-birth">Date of birth</label><input id="date-of-birth" className={styles.input} type="date" required max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(changeEvent) => setDateOfBirth(changeEvent.target.value)} /></div>{error && <div className={styles.messageError} role="alert">{error}</div>}<div className={styles.modalActions}><button type="submit" className={styles.primaryButton} disabled={isSaving}>{isSaving ? "Saving..." : "Save and continue"}</button></div></form></section></div>;
}
