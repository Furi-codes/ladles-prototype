"use client";
import { useState } from 'react';
import { loadSettings, saveSettings, saveAdminName } from '@/lib/actions/corporate';
import { useAdminData } from './AdminProvider';
import { Field, FeatureState, useFeatureData } from './FeatureShared';
import styles from '../admin.module.css';
const preferences = [ ['booking_confirmation_enabled','Booking confirmation'], ['booking_cancellation_enabled','Booking cancellation'], ['shift_reminder_enabled','Shift reminder'], ['corporate_booking_confirmation_enabled','Corporate booking confirmation'] ] as const;
export default function SettingsManager() {
  const { data, loading, error, reload } = useFeatureData(loadSettings);
  const { adminProfile } = useAdminData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(form: FormData) {
    setBusy(true); setMessage('');
    try {
      await saveSettings({ organisation_name: String(form.get('organisation_name')).trim(), default_location: String(form.get('default_location')).trim(), contact_email: String(form.get('contact_email')).trim(), timezone: 'Africa/Johannesburg',
        booking_confirmation_enabled: form.has('booking_confirmation_enabled'), booking_cancellation_enabled: form.has('booking_cancellation_enabled'), shift_reminder_enabled: form.has('shift_reminder_enabled'), corporate_booking_confirmation_enabled: form.has('corporate_booking_confirmation_enabled') });
      await reload(); setMessage('Organisation settings saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save settings.'); } finally { setBusy(false); }
  }
  async function account(form: FormData) {
    setBusy(true); setMessage('');
    try { await saveAdminName(String(form.get('full_name'))); setMessage('Account name saved. Your header will update on the next page load.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save account.'); } finally { setBusy(false); }
  }
  return <div className={styles.featureStack}><FeatureState error={error} loading={loading} retry={reload} />{message && <p role="status" className={styles.helper}>{message}</p>}
    {data && <><form action={save} key={data.settings.updated_at} className={styles.featureStack}>
      <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Organisation</h2></div><div className={`${styles.featureBody} ${styles.formGrid}`}>
        <Field label="Organisation name"><input name="organisation_name" className={styles.input} required defaultValue={data.settings.organisation_name} /></Field>
        <Field label="Default location"><input name="default_location" className={styles.input} defaultValue={data.settings.default_location} /></Field>
        <Field label="Contact email"><input type="email" name="contact_email" className={styles.input} defaultValue={data.settings.contact_email} /></Field>
        <Field label="Timezone"><select className={styles.select} defaultValue="Africa/Johannesburg"><option>Africa/Johannesburg</option></select></Field>
        <p className={`${styles.helper} ${styles.fieldFull}`}>Organisation defaults are stored for administration. Existing events and attendance use their current settings.</p>
      </div></section>
      <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Notifications</h2></div><div className={`${styles.featureBody} ${styles.featureStack}`}><p className={styles.helper}>Preferences are stored for future delivery integration. They do not send emails or messages and do not change existing in-app event cancellation notifications.</p>{preferences.map(([key,label]) => <label key={key} className={styles.helper}><input type="checkbox" name={key} defaultChecked={data.settings[key]} /> {label}</label>)}<button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save organisation & preferences'}</button></div></section>
    </form>
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Administrators / Access</h2></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{data.admins.map(a => <tr key={a.id}><td>{a.full_name}</td><td>{a.email}</td><td>Administrator</td></tr>)}</tbody></table></div><p className={`${styles.featureBody} ${styles.helper}`}>Access changes are managed through your authorised database administrator. This page cannot assign roles.</p></section></>}
    <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Account</h2></div><form action={account} className={`${styles.featureBody} ${styles.formGrid}`}><Field label="Your name"><input name="full_name" className={styles.input} required defaultValue={adminProfile.full_name} /></Field><Field label="Email"><input className={styles.input} value={adminProfile.email ?? ''} readOnly /></Field><p className={styles.helper}>Use the existing “Forgot password” flow on the sign-in page to reset your password.</p><div className={styles.formActions}><button className={styles.primaryButton} disabled={busy}>Save account name</button></div></form></section>
  </div>;
}
