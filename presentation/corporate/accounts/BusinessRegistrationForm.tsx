"use client";

/**
 * Lets admin open or close business account registration.
 * The saved volunteer cellphone setting is passed through unchanged, so this corporate control
 * does not alter volunteer requirements.
 */

import { useState } from 'react';
import { setCorporateRolloutSettings } from '@/business/corporate/services/accounts';
import type { CorporateRolloutSettings } from '@/business/corporate/types/accounts';
import { userFacingError } from '@/business/shared/errors/user-facing';
import styles from '@/presentation/styles/admin.module.css';
import management from '@/presentation/components/ui/management.module.css';
import ui from '@/presentation/styles/corporate.module.css';

export default function BusinessRegistrationForm({ initial, saved, dirtyChanged }: { initial: CorporateRolloutSettings; saved: () => Promise<void>; dirtyChanged: (dirty: boolean) => void }) {
  const [registration, setRegistration] = useState(initial.registration_enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return <form onSubmit={async event => {
    event.preventDefault(); if (busy || !window.confirm(registration ? 'Open registration for new business accounts?' : 'Close registration for new business accounts? Existing accounts and bookings will remain available.')) return;
    setBusy(true); setError('');
    try {
      // The existing endpoint saves both values. Preserve the volunteer setting when changing business registration.
      await setCorporateRolloutSettings(registration, initial.volunteer_phone_required);
      dirtyChanged(false); setMessage('Business registration settings saved.'); await saved();
    }
    catch (failure) { setError(userFacingError(failure, 'Business registration settings could not be saved.')); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Registration access</legend><label className={management.preference}><input type="checkbox" checked={registration} onChange={event => { setRegistration(event.target.checked); dirtyChanged(event.target.checked !== initial.registration_enabled); }} />Open business account registration</label><p className={styles.helper}>New companies must verify their email address and receive admin approval before requesting a booking.</p>{error && <p className={styles.error} role="alert">{error}</p>}{message && <p role="status">{message}</p>}<div className={ui.formFooter}><button type="submit" className={styles.primaryButton}>{busy ? 'Saving…' : 'Save settings'}</button></div></fieldset></form>;
}
