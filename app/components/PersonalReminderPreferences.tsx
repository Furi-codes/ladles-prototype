"use client";
import { userFacingError } from '@/lib/user-facing-error';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getReminderPreferences, saveReminderPreferences } from '@/lib/actions/reminder-preferences';
import type { ReminderPortal } from '@/lib/reminder-preferences';
import { useFeatureData } from '@/app/admin/components/FeatureShared';
import { corporateNoticesChanged } from '@/lib/corporate-notifications';
import styles from '@/app/volunteer/volunteer.module.css';
import ui from '@/app/volunteer/components/notifications.module.css';
import css from './personal-reminders.module.css';

/** Separate choices, one saved pair. Optional reminders never disable booking updates. */
export default function PersonalReminderPreferences({ portal }: { portal: ReminderPortal }) {
  const loader = useCallback(() => getReminderPreferences(portal), [portal]);
  const { data, loading, error: loadError, reload } = useFeatureData(loader);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    const refresh = () => { if (!pending.current) void reload(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [reload]);

  async function change(kind: 'reminder_24h' | 'reminder_2h', enabled: boolean) {
    if (pending.current || loading || !data || data.portal !== portal) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await saveReminderPreferences(portal, kind === 'reminder_24h' ? enabled : data.reminder_24h, kind === 'reminder_2h' ? enabled : data.reminder_2h);
      // Opting out also marks that type's existing reminders read, so refresh the bell/inbox.
      window.dispatchEvent(new Event(portal === 'corporate' ? corporateNoticesChanged : 'volunteer-reminder-preferences-changed'));
      setMessage('Reminder preferences updated.');
      await reload();
    } catch (failure) { setError(userFacingError(failure instanceof Error ? failure.message : 'Your reminder preferences could not be saved. Please retry.', "Your reminder preferences could not be saved. Please retry.")); }
    finally { pending.current = false; setBusy(false); }
  }

  const disabled = loading || busy || !data || data.portal !== portal || Boolean(loadError);
  const titleId = `${portal}-reminder-preferences-title`;
  return <section id="notification-preferences" className={styles.card} aria-labelledby={titleId}>
    <div className={styles.cardHeader}><div><h2 id={titleId} className={styles.cardTitle}>Notification preferences</h2><p className={styles.cardHint}>Choose when to receive {portal === 'corporate' ? 'confirmed session' : 'shift'} reminders.</p></div></div>
    <div className={`${styles.settingsBody} ${css.body}`}>
      {(['reminder_24h', 'reminder_2h'] as const).map((kind, index) => <label key={kind} className={ui.preference}>
        <span><strong>{index === 0 ? '24 hours before' : '2 hours before'}</strong><span className={ui.preferenceHint}>{index === 0 ? 'A reminder the day before your session.' : 'A reminder shortly before your session starts.'}</span></span>
        <input type="checkbox" role="switch" aria-label={index === 0 ? '24-hour reminders' : '2-hour reminders'} checked={data?.portal === portal && data[kind] === true} disabled={disabled} onChange={event => void change(kind, event.target.checked)} />
      </label>)}
      <p className={styles.cardHint}>Changes save automatically. Choose both, either one, or turn both off. Booking updates and cancellations stay on.</p>
      <p className={styles.cardHint}>In-app reminders only. Email and SMS are not sent.</p>
      {(busy || loading) && <p role="status">{busy ? 'Saving preferences…' : 'Loading preferences…'}</p>}
      {message && !loadError && <p role="status">{message}</p>}
      {(error || loadError) && <div className={styles.messageError} role="alert">{error || loadError}{loadError && <button type="button" className={styles.secondaryButton} disabled={loading || busy} onClick={() => void reload()}>Retry</button>}</div>}
    </div>
  </section>;
}
