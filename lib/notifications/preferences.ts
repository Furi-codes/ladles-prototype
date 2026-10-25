/**
 * Checks the reminder-preference object returned by the server.
 * Malformed data is rejected instead of silently presenting incorrect on/off switches.
 */

export type ReminderPortal = 'volunteer' | 'corporate';
export type ReminderPreferences = { portal: ReminderPortal; reminder_24h: boolean; reminder_2h: boolean };

/** Reject an incomplete response rather than displaying a preference the database did not confirm. */
export function checkedReminderPreferences(value: unknown, portal: ReminderPortal): ReminderPreferences {
  if (portal !== 'volunteer' && portal !== 'corporate') throw new Error('Choose a valid portal.');
  if (!value || typeof value !== 'object' || !('portal' in value) || value.portal !== portal ||
    !('reminder_24h' in value) || typeof value.reminder_24h !== 'boolean' ||
    !('reminder_2h' in value) || typeof value.reminder_2h !== 'boolean') throw new Error('Reminder preferences could not be confirmed. Please retry.');
  return { portal, reminder_24h: value.reminder_24h, reminder_2h: value.reminder_2h };
}
