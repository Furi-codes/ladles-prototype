/**
 * Loads and saves the current user's reminder preferences.
 * The RPC chooses the signed-in identity; callers do not supply another user's ID.
 */

import { supabase } from '@/lib/supabase/client';
import { checkedReminderPreferences, type ReminderPortal } from '@/lib/notifications/preferences';

/** Both RPCs identify the account from Auth; callers cannot supply another user's ID. */
export async function getReminderPreferences(portal: ReminderPortal) {
  if (portal !== 'volunteer' && portal !== 'corporate') throw new Error('Choose a valid portal.');
  const { data, error } = await supabase.rpc('get_personal_reminder_preferences', { p_portal: portal });
  if (error) throw new Error('Your reminder preferences could not be loaded. Please retry.');
  return checkedReminderPreferences(data, portal);
}

/**
 * Save both threshold choices for the current identity and check the returned preference shape.
 */
export async function saveReminderPreferences(portal: ReminderPortal, reminder24h: boolean, reminder2h: boolean) {
  checkedReminderPreferences({ portal, reminder_24h: reminder24h, reminder_2h: reminder2h }, portal);
  const { data, error } = await supabase.rpc('set_personal_reminder_preferences', { p_portal: portal, p_24h: reminder24h, p_2h: reminder2h });
  if (error) throw new Error('Your reminder preferences could not be saved. Please retry.');
  const result = checkedReminderPreferences(data, portal);
  if (result.reminder_24h !== reminder24h || result.reminder_2h !== reminder2h) throw new Error('Your reminder preferences could not be confirmed. Reload and try again.');
  return result;
}
