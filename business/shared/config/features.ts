/**
 * Defines the corporate feature switches used by this deployment.
 * These switches control availability in the app; they do not replace database schema or
 * permission checks.
 */

export const corporateRolloutEnabled = process.env.NEXT_PUBLIC_CORPORATE_ROLLOUT_ENABLED !== 'false';
export const corporateBookingsEnabled = corporateRolloutEnabled && process.env.NEXT_PUBLIC_CORPORATE_BOOKINGS_ENABLED !== 'false';
export const corporateChangesEnabled = corporateBookingsEnabled && process.env.NEXT_PUBLIC_CORPORATE_CHANGES_ENABLED !== 'false';
export const corporateOutcomesEnabled = corporateChangesEnabled && process.env.NEXT_PUBLIC_CORPORATE_OUTCOMES_ENABLED !== 'false';
