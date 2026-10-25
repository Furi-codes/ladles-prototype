/**
 * Loads and saves portal contact methods and corporate booking availability.
 * Inputs and responses are checked before callers use them, with technical failures converted to
 * suitable messages.
 */

import { supabase } from '@/lib/supabase/client';
import { cleanPortalContacts, type ContactPortal, type PortalContact, type PortalContactSettings } from '@/lib/contacts/validation';

function validatePortal(portal: ContactPortal) {
  if (!['volunteer','corporate'].includes(portal)) throw new Error('Choose a valid portal.');
}
/**
 * Reject malformed settings instead of treating an unexpected RPC response as usable contact
 * details.
 */
function checkedResult(data: PortalContactSettings | null, portal: ContactPortal) {
  if (!data || data.portal !== portal || !Number.isSafeInteger(data.version) || data.version < 1) throw new Error('Contact settings could not be confirmed. Please reload.');
  return { ...data, contacts: cleanPortalContacts(data.contacts) };
}
function contactError(error: { code?: string; message: string }) {
  return ['PGRST202','42P01','42883'].includes(error.code ?? '') ? 'Portal contacts are temporarily unavailable. Please try again later.' : error.message;
}
/**
 * Read the selected portal's approved contact methods without exposing unrelated settings.
 */
export async function getPortalContacts(portal: ContactPortal): Promise<PortalContactSettings> {
  validatePortal(portal);
  const { data, error } = await supabase.rpc('get_portal_contacts', { p_portal: portal });
  if (error) throw new Error(contactError(error));
  return checkedResult(data, portal);
}
/** Save only the chosen portal. Version checks prevent two admins silently overwriting each other. */
export async function savePortalContacts(portal: ContactPortal, version: number, contacts: PortalContact[]): Promise<PortalContactSettings> {
  validatePortal(portal);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Reload the contact settings before saving.');
  const { data, error } = await supabase.rpc('save_portal_contacts', { p_portal: portal, p_version: version, p_contacts: cleanPortalContacts(contacts) });
  if (error) throw new Error(contactError(error));
  return checkedResult(data, portal);
}
/**
 * Update request availability through the contact-aware database operation, which requires
 * primary corporate contacts before opening.
 */
export async function setCorporateBookingAvailability(enabled: boolean) {
  if (typeof enabled !== 'boolean') throw new Error('Choose whether corporate requests are open.');
  const { data, error } = await supabase.rpc('set_corporate_booking_availability', { p_enabled: enabled });
  if (error) throw new Error(contactError(error));
  if (!data || data.booking_enabled !== enabled) throw new Error('Booking availability could not be confirmed. Refresh before retrying.');
  return data;
}
