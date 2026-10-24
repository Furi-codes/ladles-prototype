import { getCorporateBookingNotices } from './actions/corporate-bookings';

export const corporateNoticesChanged = 'corporate-booking-notices-changed';

/** Count every page, not just the latest ten. The bell displays 99+ once we reach 100. */
export async function corporateUnreadBookingCount() {
  let expectedTotal: number | undefined, unread = 0;
  const seen = new Set<string>();
  for (let page = 1; ; page++) {
    const result = await getCorporateBookingNotices(page);
    if (!Number.isInteger(result.total) || result.total < 0 || !Array.isArray(result.rows) ||
      expectedTotal !== undefined && result.total !== expectedTotal ||
      result.rows.length > 10 || seen.size + result.rows.length > result.total ||
      result.rows.length < 10 && seen.size + result.rows.length < result.total ||
      !result.rows.length && seen.size < result.total) throw new Error('Notifications changed while loading. Open notifications to retry.');
    expectedTotal = result.total;
    for (const notice of result.rows) {
      if (seen.has(notice.id)) throw new Error('Notifications changed while loading. Open notifications to retry.');
      seen.add(notice.id);
      if (!notice.is_read) unread++;
    }
    if (unread >= 100) return 100;
    if (seen.size === expectedTotal) return unread;
  }
}
