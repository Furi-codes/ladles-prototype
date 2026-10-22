/** Corporate screens are part of the normal app. Explicit false remains an emergency UI switch.
 * These switches never grant access: checked database functions and RLS enforce permissions. */
export const corporateRolloutEnabled = process.env.NEXT_PUBLIC_CORPORATE_ROLLOUT_ENABLED !== 'false';
export const corporateBookingsEnabled = corporateRolloutEnabled && process.env.NEXT_PUBLIC_CORPORATE_BOOKINGS_ENABLED !== 'false';
export const corporateChangesEnabled = corporateBookingsEnabled && process.env.NEXT_PUBLIC_CORPORATE_CHANGES_ENABLED !== 'false';
export const corporateOutcomesEnabled = corporateChangesEnabled && process.env.NEXT_PUBLIC_CORPORATE_OUTCOMES_ENABLED !== 'false';
