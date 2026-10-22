import { corporateRolloutEnabled, corporateBookingsEnabled } from '@/lib/feature-flags';
import { getMyCorporateAccount } from '@/lib/actions/corporate-accounts';

/** Login chooses a workspace; database RLS/RPCs, not this redirect, decide permissions. */
export const workspaceChoicePath = '/?workspace=choose';
export async function accountLandingPath(role?: string, corporateIntent = false, volunteerEnabled = false): Promise<string> {
  if (role === 'admin') return '/admin';
  if (corporateRolloutEnabled) {
    const account = await getMyCorporateAccount();
    // Navigation choices use stored membership; database policies still decide access to every record.
    if (account && volunteerEnabled) return workspaceChoicePath;
    if (account) return corporateBookingsEnabled && account.status === 'Approved' ? '/corporate/bookings' : '/corporate';
    if (corporateIntent) return '/corporate/register';
  }
  return '/volunteer';
}
