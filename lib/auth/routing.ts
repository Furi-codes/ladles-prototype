/**
 * Chooses the landing page after successful authentication.
 * Business membership is looked up separately from the stored admin/volunteer profile role.
 */

import { corporateRolloutEnabled, corporateBookingsEnabled } from '@/lib/config/features';
import { getMyCorporateAccount } from '@/features/corporate/services/accounts';

/** Login chooses a workspace; database RLS/RPCs, not this redirect, decide permissions. */
export async function accountLandingPath(role?: string): Promise<string> {
  if (role === 'admin') return '/admin';
  if (corporateRolloutEnabled) {
    const account = await getMyCorporateAccount();
    if (account) return corporateBookingsEnabled && account.status === 'Approved' ? '/corporate/bookings' : '/corporate';
  }
  return '/volunteer';
}
