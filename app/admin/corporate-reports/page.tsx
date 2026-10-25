/**
 * Opens the corporate analytics at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import CorporateOutcomeReports from '@/features/corporate/reports/CorporateOutcomeReports';

/** Keep corporate outcomes separate from volunteer analytics, using the same checked report/export flow. */
export default function CorporateAnalyticsPage() {
  return <CorporateOutcomeReports admin />;
}
