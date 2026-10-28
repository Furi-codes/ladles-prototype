/** Application entry point for admin management. Screens use this layer; the repository owns database requests. */
export * from '@/data/admin/management';

import { approveVolunteerHours as persistApprovedHours } from '@/data/admin/management';
import { userFacingError } from '@/business/shared/errors/user-facing';

/** Convert a failed persistence operation to the application message while preserving the stale-save protection. */
export async function approveVolunteerHours(...args: Parameters<typeof persistApprovedHours>) {
  try { return await persistApprovedHours(...args); }
  catch (error) { throw new Error(userFacingError(error, 'Hours could not be approved. Refresh the roster and try again.')); }
}
