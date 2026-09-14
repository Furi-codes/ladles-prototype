"use client";

import { useState } from "react";
import styles from "../volunteer.module.css";

export default function ConsentPrompt({ onAccept }: { onAccept: () => Promise<string | null> }) {
  const [codeOfConduct, setCodeOfConduct] = useState(false);
  const [dataUse, setDataUse] = useState(false);
  const [informationAccuracy, setInformationAccuracy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const complete = codeOfConduct && dataUse && informationAccuracy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) {
      setError("Please confirm all three statements before continuing.");
      return;
    }
    setIsSaving(true);
    setError(null);
    const saveError = await onAccept();
    if (saveError) setError(saveError);
    setIsSaving(false);
  }

  return <div className={styles.backdrop}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <h2 id="consent-title" className={styles.cardTitle}>Complete your volunteer onboarding</h2>
      <p className={styles.cardHint} style={{ marginTop: 9 }}>Before you continue, please review and confirm these volunteer commitments.</p>
      <form onSubmit={submit} className={styles.consentForm}>
        <label className={styles.consentOption}><input type="checkbox" checked={codeOfConduct} onChange={(event) => setCodeOfConduct(event.target.checked)} /> <span>I agree to Ladles of Love&apos;s volunteer code of conduct.</span></label>
        <label className={styles.consentOption}><input type="checkbox" checked={dataUse} onChange={(event) => setDataUse(event.target.checked)} /> <span>I understand my information is used to manage bookings, attendance, and volunteer hours.</span></label>
        <label className={styles.consentOption}><input type="checkbox" checked={informationAccuracy} onChange={(event) => setInformationAccuracy(event.target.checked)} /> <span>I confirm that the information I provided is accurate.</span></label>
        {error && <div className={styles.messageError} role="alert">{error}</div>}
        <div className={styles.modalActions}><button type="submit" className={styles.primaryButton} disabled={!complete || isSaving}>{isSaving ? "Saving..." : "Agree and continue"}</button></div>
      </form>
    </section>
  </div>;
}
