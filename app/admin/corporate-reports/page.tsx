import CorporateOutcomeReports from '@/app/corporate/components/CorporateOutcomeReports';

/** Keep corporate outcomes separate from volunteer analytics, using the same checked report/export flow. */
export default function CorporateAnalyticsPage() {
  return <CorporateOutcomeReports admin />;
}
