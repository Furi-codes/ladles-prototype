import { corporateRolloutEnabled, corporateBookingsEnabled } from '@/lib/feature-flags';
import { getMyCorporateAccount } from '@/lib/actions/corporate-accounts';

/** Login chooses a workspace; database RLS/RPCs, not this redirect, decide permissions. */
export async function accountLandingPath(role?: string): Promise<string> {
  if (role === 'admin') return '/admin';
  if (corporateRolloutEnabled) {
    const account = await getMyCorporateAccount();
    if (account) return corporateBookingsEnabled && account.status === 'Approved' ? '/corporate/bookings' : '/corporate';
  }
  return '/volunteer';
}
