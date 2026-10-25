"use client";
/**
 * Switches between portal contacts, administrator access, activity and account controls.
 * Only the selected panel is displayed, with unsaved changes checked before switching away.
 */

import { userFacingError } from '@/lib/errors/user-facing';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadSettings, saveAdminName } from '@/features/admin/services/settings';
import { logAdminAction, loadAdminAuditLog } from '@/features/admin/services/audit';
import { useAdminData } from '@/features/admin/shell/AdminProvider';
import { Field, FeatureState, useFeatureData } from '@/components/ui/FeatureShared';
import AdminAccessManager from '@/features/admin/settings/AdminAccessManager';
import ActivityDetails from '@/features/admin/settings/ActivityDetails';
import { activityAction, activityRecordType } from '@/features/admin/utils/activity';
import PortalContactSettings from '@/features/admin/settings/PortalContactSettings';
import ChangePasswordForm from '@/features/auth/ChangePasswordForm';
import styles from '@/styles/admin.module.css';
import ui from '@/components/ui/management.module.css';
import visual from '@/features/admin/analytics/analytics.module.css';
const settingsSections = [['contact-settings','Portal contacts'],['access-settings','Administrator access'],['activity-settings','Recent activity'],['account-settings','My account']] as const;
type SettingsSection = typeof settingsSections[number][0];
export default function SettingsManager() {
  const requestedSection = useSearchParams().get('section');
  const { data, loading, error, reload } = useFeatureData(loadSettings);
  const { data: auditEntries, loading: auditLoading, error: auditError, reload: reloadAudit } = useFeatureData(loadAdminAuditLog);
  const { adminProfile } = useAdminData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [section, setSection] = useState<SettingsSection>(settingsSections.some(([id]) => id === requestedSection) ? requestedSection as SettingsSection : 'contact-settings');
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
  async function account(form: FormData) {
    setBusy(true); setMessage('');
    try {
      const name = String(form.get('full_name')).trim();
      await saveAdminName(name);
      await logAdminAction({ action: 'ADMIN_ACCOUNT_NAME_UPDATED', entityType: 'PROFILE', entityLabel: name });
      await reloadAudit();
      setMessage('Account name saved. Your header will update on the next page load.');
    }
    catch (e) { setMessage(userFacingError(e instanceof Error ? e.message : 'Unable to save account.', "Unable to save account.")); } finally { setBusy(false); }
  }
  return <div className={ui.workspace}><div className={`${visual.tabs} ${ui.settingsTabs}`} role="tablist" aria-label="Settings sections">{settingsSections.map(([id,label], index) => <button key={id} ref={button => { tabButtons.current[index] = button; }} type="button" role="tab" id={`tab-${id}`} aria-controls={id} aria-selected={section === id} tabIndex={section === id ? 0 : -1} disabled={busy} onClick={() => setSection(id)} onKeyDown={event => navigateTabs(event, index)}>{label}</button>)}</div><FeatureState error={error} loading={loading} retry={reload} />{message && <p role="status" className={styles.helper}>{message}</p>}
    {data && <>
    <div id="access-settings" role="tabpanel" aria-labelledby="tab-access-settings" tabIndex={0} hidden={section !== 'access-settings'} className={ui.settingsPanel}><AdminAccessManager admins={data.admins} reload={reload} /></div></>}
    <div id="contact-settings" role="tabpanel" aria-labelledby="tab-contact-settings" tabIndex={0} hidden={section !== 'contact-settings'} className={ui.settingsPanel}><PortalContactSettings busyChanged={setBusy} /></div>
    <section id="activity-settings" role="tabpanel" aria-labelledby="tab-activity-settings" tabIndex={0} hidden={section !== 'activity-settings'} className={`${styles.card} ${ui.settingsPanel}`}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Recent admin & WMS activity</h2><button type="button" className={styles.secondaryButton} onClick={() => void reloadAudit()} disabled={auditLoading}>Refresh</button></div><div className={styles.featureBody}>
      {auditError && <p role="alert" className={styles.error}>{auditError}</p>}
      {auditLoading && <p role="status" className={styles.helper}>Loading activity…</p>}
      {!auditLoading && auditEntries?.length === 0 && <p className={styles.helper}>No activity has been recorded yet.</p>}
      {!!auditEntries?.length && <div data-mobile-table className={ui.tableViewport} tabIndex={0} role="region" aria-label="Recent administrator and WMS activity"><table role="table" className={styles.table}><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">When (SA time)</th><th role="columnheader" scope="col">Administrator / source</th><th role="columnheader" scope="col">Action</th><th role="columnheader" scope="col">Record</th></tr></thead><tbody role="rowgroup">{auditEntries.map(entry => <tr role="row" key={entry.id}><td role="cell" data-label="When (SA time)">{new Date(entry.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</td><td role="cell" data-label="Administrator / source">{entry.admin_name}</td><td role="cell" data-label="Action">{activityAction(entry.action)}</td><td role="cell" data-label="Record">{entry.entity_label || activityRecordType(entry.entity_type)}<ActivityDetails details={entry.details} /></td></tr>)}</tbody></table></div>}
    </div></section>
    <div id="account-settings" role="tabpanel" aria-labelledby="tab-account-settings" tabIndex={0} hidden={section !== 'account-settings'} className={`${ui.settingsPanel} ${ui.workspace}`}><section className={styles.card}><div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>My account</h2><p className={styles.cardHint}>Your administrator name and sign-in email.</p></div></div><form action={account} className={`${styles.featureBody} ${styles.formGrid}`}><Field label="Your name"><input name="full_name" className={styles.input} required defaultValue={adminProfile.full_name} /></Field><Field label="Email"><input className={styles.input} value={adminProfile.email ?? ''} readOnly /></Field><div className={styles.formActions}><button className={styles.primaryButton} disabled={busy}>Save account name</button></div></form></section><ChangePasswordForm email={adminProfile.email || ''} /></div>
  </div>;
}
