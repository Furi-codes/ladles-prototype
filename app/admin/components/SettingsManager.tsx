"use client";
import { useRef, useState, type KeyboardEvent } from 'react';
import { loadSettings, saveNotificationSettings, saveAdminName } from '@/lib/actions/corporate';
import { logAdminAction, loadAdminAuditLog } from '@/lib/actions/audit';
import { useAdminData } from './AdminProvider';
import { Field, FeatureState, useFeatureData } from './FeatureShared';
import AdminAccessManager from './AdminAccessManager';
import styles from '../admin.module.css';
import ui from './management.module.css';
import visual from './analytics.module.css';
const settingsSections = [['notification-settings','Notifications'],['access-settings','Administrator access'],['activity-settings','Recent activity'],['account-settings','My account']] as const;
type SettingsSection = typeof settingsSections[number][0];
const preferences = [ ['booking_confirmation_enabled','Booking confirmation (future delivery)'], ['booking_cancellation_enabled','Booking cancellation (future delivery)'], ['shift_reminder_enabled','In-app shift reminders: 24 hours and 2 hours before'], ['corporate_booking_confirmation_enabled','Corporate booking confirmation (future delivery)'] ] as const;
export default function SettingsManager() {
  const { data, loading, error, reload } = useFeatureData(loadSettings);
  const { data: auditEntries, loading: auditLoading, error: auditError, reload: reloadAudit } = useFeatureData(loadAdminAuditLog);
  const { adminProfile } = useAdminData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [section, setSection] = useState<SettingsSection>('notification-settings');
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % settingsSections.length
      : event.key === 'ArrowLeft' ? (index + settingsSections.length - 1) % settingsSections.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? settingsSections.length - 1 : null;
    if (next === null || busy) return;
    event.preventDefault();
    setSection(settingsSections[next][0]);
    tabButtons.current[next]?.focus();
  }
  async function save(form: FormData) {
    setBusy(true); setMessage('');
    try {
      await saveNotificationSettings({
        booking_confirmation_enabled: form.has('booking_confirmation_enabled'), booking_cancellation_enabled: form.has('booking_cancellation_enabled'), shift_reminder_enabled: form.has('shift_reminder_enabled'), corporate_booking_confirmation_enabled: form.has('corporate_booking_confirmation_enabled') });
      await logAdminAction({
        action: 'NOTIFICATION_PREFERENCES_UPDATED',
        entityType: 'ORGANISATION_SETTINGS',
        entityId: '1',
        entityLabel: 'Ladles of Love',
        details: { preferences_updated: true },
      });
      await reloadAudit();
      await reload(); setMessage('Notification preferences saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save settings.'); } finally { setBusy(false); }
  }
  async function account(form: FormData) {
    setBusy(true); setMessage('');
    try {
      const name = String(form.get('full_name')).trim();
      await saveAdminName(name);
      await logAdminAction({ action: 'ADMIN_ACCOUNT_NAME_UPDATED', entityType: 'PROFILE', entityLabel: name });
      await reloadAudit();
      setMessage('Account name saved. Your header will update on the next page load.');
    }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save account.'); } finally { setBusy(false); }
  }
  return <div className={ui.workspace}><div className={`${visual.tabs} ${ui.settingsTabs}`} role="tablist" aria-label="Settings sections">{settingsSections.map(([id,label], index) => <button key={id} ref={button => { tabButtons.current[index] = button; }} type="button" role="tab" id={`tab-${id}`} aria-controls={id} aria-selected={section === id} tabIndex={section === id ? 0 : -1} disabled={busy} onClick={() => setSection(id)} onKeyDown={event => navigateTabs(event, index)}>{label}</button>)}</div><FeatureState error={error} loading={loading} retry={reload} />{message && <p role="status" className={styles.helper}>{message}</p>}
    {data && <><form action={save} key={data.settings.updated_at} className={`${styles.featureStack} ${ui.settingsPanel}`} hidden={section !== 'notification-settings'}>
      <section id="notification-settings" role="tabpanel" aria-labelledby="tab-notification-settings" tabIndex={0} hidden={section !== 'notification-settings'} className={`${styles.card} ${ui.settingsPanel}`}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Notification preferences</h2><p className={styles.cardHint}>Control in-app shift reminders and store future delivery preferences.</p></div></div><div className={`${styles.featureBody} ${styles.featureStack}`}><p className={styles.helper}>Shift reminders appear in the volunteer inbox at the 24-hour and 2-hour thresholds, checked every five minutes. Late bookings receive the next applicable reminder. Turning this off stops new reminders, not event cancellation updates. The other preferences are stored for future integration; email and SMS delivery are not enabled.</p>{preferences.map(([key,label]) => <label key={key} className={ui.preference}><input type="checkbox" name={key} defaultChecked={data.settings[key]} /> {label}</label>)}<button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div></section>
    </form>
    <div id="access-settings" role="tabpanel" aria-labelledby="tab-access-settings" tabIndex={0} hidden={section !== 'access-settings'} className={ui.settingsPanel}><AdminAccessManager admins={data.admins} reload={reload} /></div></>}
    <section id="activity-settings" role="tabpanel" aria-labelledby="tab-activity-settings" tabIndex={0} hidden={section !== 'activity-settings'} className={`${styles.card} ${ui.settingsPanel}`}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Recent admin & WMS activity</h2><button type="button" className={styles.secondaryButton} onClick={() => void reloadAudit()} disabled={auditLoading}>Refresh</button></div><div className={styles.featureBody}>
      {auditError && <p role="alert" className={styles.error}>{auditError}</p>}
      {auditLoading && <p role="status" className={styles.helper}>Loading activity…</p>}
      {!auditLoading && auditEntries?.length === 0 && <p className={styles.helper}>No activity has been recorded yet.</p>}
      {!!auditEntries?.length && <div className={ui.tableViewport} tabIndex={0} role="region" aria-label="Recent administrator and WMS activity"><table className={styles.table}><thead><tr><th>When (SA time)</th><th>Administrator / source</th><th>Action</th><th>Record</th></tr></thead><tbody>{auditEntries.map(entry => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</td><td>{entry.admin_name}</td><td>{entry.action.replaceAll('_', ' ')}</td><td>{entry.entity_label || entry.entity_type}{Object.keys(entry.details).length > 0 && <details><summary>View details</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: 420 }}>{JSON.stringify(entry.details, null, 2)}</pre></details>}</td></tr>)}</tbody></table></div>}
    </div></section>
    <section id="account-settings" role="tabpanel" aria-labelledby="tab-account-settings" tabIndex={0} hidden={section !== 'account-settings'} className={`${styles.card} ${ui.settingsPanel}`}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>My account</h2><p className={styles.cardHint}>Your administrator name and sign-in email.</p></div></div><form action={account} className={`${styles.featureBody} ${styles.formGrid}`}><Field label="Your name"><input name="full_name" className={styles.input} required defaultValue={adminProfile.full_name} /></Field><Field label="Email"><input className={styles.input} value={adminProfile.email ?? ''} readOnly /></Field><p className={styles.helper}>Use the existing “Forgot password” flow on the sign-in page to reset your password.</p><div className={styles.formActions}><button className={styles.primaryButton} disabled={busy}>Save account name</button></div></form></section>
  </div>;
}
