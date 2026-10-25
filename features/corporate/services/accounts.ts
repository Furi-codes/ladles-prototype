/**
 * Connects business registration, account review and directory screens to database operations.
 * Editable company fields are explicitly selected before sending them; ownership and approval
 * remain database-controlled.
 */

import { supabase } from '@/lib/supabase/client';
import { corporateRolloutEnabled } from '@/lib/config/features';
import { isValidPhone, normalisePhone } from '@/lib/validation/contact-details';
import type { CorporateAccount, CorporateAccountDetail, CorporateAccountInput, CorporateAccountListItem, CorporateAccountStatus, CorporateRolloutSettings, PagedRows, VolunteerDirectoryItem } from '@/features/corporate/types/accounts';

/**
 * Stop calls when corporate account features are disabled in this deployment.
 */
function requireRollout() {
  if (!corporateRolloutEnabled) throw new Error('Corporate account rollout is not enabled on this deployment.');
}

/** Missing migrations must be visible, not treated as an empty company list or successful registration. */
export function corporateAccountError(error: { code?: string; message: string }) {
  return ['PGRST202', 'PGRST205', '42P01', '42703', '42883'].includes(error.code ?? '')
    ? 'Corporate account access is temporarily unavailable. Please contact the booking team.'
    : error.message;
}

/**
 * Use one RPC/error path for account operations. A missing result is not treated as a successful
 * write or an empty account.
 */
async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  requireRollout();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(corporateAccountError(error));
  if (data === null || data === undefined) throw new Error('The server returned no result. Refresh and check the saved record before retrying.');
  return data as T;
}

/** Only editable fields are sent; callers cannot choose ownership, status or the approval timestamp. */
export function cleanCorporateAccount(input: CorporateAccountInput): CorporateAccountInput {
  const keys = ['company_name', 'contact_name', 'contact_email', 'contact_phone', 'billing_address'] as const;
  if (!input || keys.some(key => typeof input[key] !== 'string')) throw new Error('Complete the company and contact details.');
  const clean = Object.fromEntries(keys.map(key => [key, input[key].trim()])) as unknown as CorporateAccountInput;
  clean.contact_phone = normalisePhone(clean.contact_phone);
  if (!clean.company_name || !clean.contact_name || !clean.billing_address || clean.company_name.length > 180 || clean.contact_name.length > 180 || clean.billing_address.length > 1000) throw new Error('Enter the company name, main contact and full billing address.');
  if (clean.contact_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.contact_email) || !isValidPhone(clean.contact_phone)) throw new Error('Enter a valid contact email and phone number.');
  // Construct this explicitly: extra properties supplied by JavaScript must not reach the RPC.
  return { company_name: clean.company_name, contact_name: clean.contact_name, contact_email: clean.contact_email, contact_phone: clean.contact_phone, billing_address: clean.billing_address };
}

/**
 * Read the saved registration/contact requirements rather than deciding them from a browser
 * checkbox alone.
 */
export async function getCorporateRolloutSettings() {
  return call<CorporateRolloutSettings>('corporate_get_rollout_settings');
}

/** Safe to call before signup: returns no accounts, contact details or administrator identity. */
export async function requireCorporateRegistrationOpen() {
  const status = await call<{ schema_version: number; registration_enabled: boolean }>('corporate_registration_status');
  if (status.schema_version !== 1 || status.registration_enabled !== true) throw new Error('Business registration is not open yet. Please try again later.');
}

/**
 * Submit the requested access settings; the database checks the caller's admin permission.
 */
export async function setCorporateRolloutSettings(registrationEnabled: boolean, phoneRequired: boolean) {
  return call<CorporateRolloutSettings>('corporate_set_rollout_settings', { p_registration_enabled: registrationEnabled, p_volunteer_phone_required: phoneRequired });
}

/**
 * Verify the current Auth user and read only their owned business account. RLS provides the
 * database-level boundary as well.
 */
export async function getMyCorporateAccount(): Promise<CorporateAccount | null> {
  requireRollout();
  // RLS filters to this identity. A corporate membership does not replace profiles.role.
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== 'AuthSessionMissingError') throw new Error('Account access could not be checked. Please check your connection and retry.');
  if (!auth.user) throw new Error('Please sign in again.');
  const { data, error } = await supabase.from('corporate_accounts').select('*').eq('owner_user_id', auth.user.id).maybeSingle();
  if (error) throw new Error(corporateAccountError(error));
  return data as CorporateAccount | null;
}

/**
 * Submit only cleaned company details. Ownership and initial review status are set by the
 * protected database function.
 */
export async function registerCorporateAccount(input: CorporateAccountInput) {
  return call<CorporateAccount>('corporate_register_account', { p_details: cleanCorporateAccount(input) });
}

/**
 * Update company/contact details through the account RPC, keeping the sign-in email outside this
 * payload.
 */
export async function saveCorporateAccount(accountId: string, input: CorporateAccountInput) {
  return call<CorporateAccount>('corporate_update_account', { p_account_id: accountId, p_details: cleanCorporateAccount(input) });
}

/**
 * Load an account review and its related history through the permission-checked RPC.
 */
export async function getCorporateAccountDetail(accountId: string) {
  return call<CorporateAccountDetail>('corporate_account_detail', { p_account_id: accountId });
}

/**
 * Request one ten-row account page using the selected search and review status.
 */
export async function searchCorporateAccounts(query = '', status: CorporateAccountStatus | '' = '', page = 1) {
  return call<PagedRows<CorporateAccountListItem>>('corporate_search_accounts', { p_query: query.trim(), p_status: status, p_offset: Math.max(0, page - 1) * 10, p_limit: 10 });
}

/**
 * Require a decision reason before asking the database to approve, reject or reconsider an
 * account.
 */
export async function reviewCorporateAccount(accountId: string, decision: 'approve' | 'reject' | 'reconsider', reason: string) {
  if (!reason.trim()) throw new Error('Record a reason for this decision.');
  return call<CorporateAccount>('corporate_review_account', { p_account_id: accountId, p_decision: decision, p_reason: reason.trim() });
}

/**
 * Mark this notice read for the signed-in identity; the notice itself remains in history.
 */
export async function readCorporateAccountNotice(id: string) {
  return call<boolean>('corporate_read_account_notice', { p_notification_id: id });
}

/** One atomic write covers every visible page. SQL chooses the current user/audience. */
export async function markAllCorporateNoticesRead() {
  const count = await call<number>('corporate_read_all_notices');
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('The read update could not be confirmed. Refresh your notifications before retrying.');
  return count;
}

/**
 * Validate search length, cellphone filter and page before requesting an admin-only directory
 * page.
 */
export async function searchVolunteerDirectory(query = '', phoneFilter = '', page = 1) {
  if (query.trim().length>180 || !['','missing','provided'].includes(phoneFilter) || !Number.isSafeInteger(page) || page<1 || (page-1)*10>2147483647) throw new Error('Choose valid directory search, cellphone filter and page.');
  return call<PagedRows<VolunteerDirectoryItem>>('corporate_volunteer_directory', { p_query: query.trim(), p_phone_filter: phoneFilter, p_offset: (page - 1) * 10, p_limit: 10 });
}
