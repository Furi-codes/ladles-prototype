/**
 * Opens the volunteer analytics at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import PageHeader from '@/features/admin/shell/PageHeader';
import ReportsManager from '@/features/admin/analytics/ReportsManager';
export default function ReportsPage() { return <><PageHeader activeNav="Analytics & Reports" /><ReportsManager /></>; }
