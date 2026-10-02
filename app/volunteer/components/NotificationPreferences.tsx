"use client";
import { useState } from "react";
import { useVolunteerData } from "./VolunteerProvider";
import styles from "../volunteer.module.css";
import ui from "./notifications.module.css";

export default function NotificationPreferences() {
  const { remindersEnabled, reminderPreferenceError, loadReminderPreference, saveReminderPreference } = useVolunteerData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { setError(await saveReminderPreference(enabled)); }
    finally { setBusy(false); }
  }
  return <section id="notification-preferences" className={styles.card} aria-labelledby="notification-preferences-title">
    <div className={styles.cardHeader}><div><h2 id="notification-preferences-title" className={styles.cardTitle}>Notification preferences</h2><p className={styles.cardHint}>Choose whether you receive optional shift reminders.</p></div></div>
    <div className={styles.settingsBody}>
      <label className={ui.preference}><span><strong>Shift reminder notifications</strong><span className={ui.preferenceHint}>24 hours and 2 hours before your booked shift, when enabled by the organisation.</span></span><input type="checkbox" role="switch" checked={remindersEnabled === true} disabled={busy || remindersEnabled === null || Boolean(reminderPreferenceError)} onChange={event => void change(event.target.checked)} aria-label="Shift reminder notifications" /></label>
      <p className={styles.cardHint}>Changes save automatically. Turning this off stops new reminders and marks existing reminders read; your history remains. Important event cancellation notices stay on. These are in-app notifications, not email, SMS or phone push alerts.</p>
      {busy && <p role="status">Saving preference...</p>}
      {remindersEnabled === null && !reminderPreferenceError && <p role="status">Loading preference...</p>}
      {(error || reminderPreferenceError) && <div className={styles.messageError} role="alert">{error ?? reminderPreferenceError}{reminderPreferenceError && <button className={styles.secondaryButton} onClick={() => void loadReminderPreference()}>Try again</button>}</div>}
    </div>
  </section>;
}
