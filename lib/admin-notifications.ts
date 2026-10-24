import { supabase } from '@/lib/supabase';
import { corporateRolloutEnabled } from './feature-flags';
import { getCorporateAccountDetail, readCorporateAccountNotice } from './actions/corporate-accounts';
import { getCorporateBookingDetail } from './actions/corporate-bookings';
import { confirmUnsavedNavigation } from './unsaved-navigation';

export const adminNoticesChanged = 'admin-corporate-notices-changed';
export type AdminNoticeKind = '' | 'account' | 'booking';
export interface AdminNotice {
  id: string; account_id: string; target_kind: 'account' | 'booking'; target_id: string | null;
  company_name: string; title: string; message: string; created_at: string; is_read: boolean;
}
export interface AdminNoticePage { rows: AdminNotice[]; total: number; unread_total: number }

/** One protected server query counts both sources, across every page and for this admin only. */
export async function loadAdminNotices(kind: AdminNoticeKind = '', unread = false, page = 1, limit = 10): Promise<AdminNoticePage> {
  if (!corporateRolloutEnabled) throw new Error('Corporate notifications are not enabled.');
  if (!['', 'account', 'booking'].includes(kind) || typeof unread !== 'boolean' || !Number.isSafeInteger(page) || page<1 || !Number.isSafeInteger((page-1)*limit) || !Number.isInteger(limit) || limit<1 || limit>100) throw new Error('Choose valid notification filters and page.');
  const { data, error } = await supabase.rpc('corporate_admin_notices', { p_kind: kind, p_unread: unread, p_offset: (page-1)*limit, p_limit: limit });
  if (error) throw new Error(['PGRST202','42883'].includes(error.code ?? '') ? 'Admin notifications are unavailable. Check that the admin inbox database update has been applied.' : error.message);
  if (!data || !Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total<0 || !Number.isSafeInteger(data.unread_total) || data.unread_total<0 || data.rows.length>limit || data.rows.length>data.total) throw new Error('Notifications could not be loaded completely. Please retry.');
  return data as AdminNoticePage;
}
export const loadAdminNoticeBadge = () => loadAdminNotices('', false, 1, 1);

/** Resolve access first; a missing target or a cancelled navigation must not mark a notice read. */
export async function openAdminNotice(notice: AdminNotice, navigate: (path: string) => void) {
  if (!confirmUnsavedNavigation()) throw new Error('Navigation cancelled. Your form is unchanged.');
  if (!notice.target_id) throw new Error('This notification has no available record. Its history is retained.');
  let path: string;
  if (notice.target_kind==='account') { await getCorporateAccountDetail(notice.target_id); path='/admin/corporate-accounts?account='+encodeURIComponent(notice.target_id); }
  else if (notice.target_kind==='booking') { await getCorporateBookingDetail(notice.target_id); path='/admin/corporate-bookings?booking='+encodeURIComponent(notice.target_id); }
  else throw new Error('This notification type is not supported.');
  await readCorporateAccountNotice(notice.id);
  if (typeof window!=='undefined') window.dispatchEvent(new Event(adminNoticesChanged));
  navigate(path);
}
