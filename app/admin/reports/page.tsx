/**
 * Opens the volunteer analytics at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import PageHeader from '@/presentation/admin/shell/PageHeader';
import ReportsManager from '@/presentation/admin/analytics/ReportsManager';
export default function ReportsPage() { return <><PageHeader activeNav="Analytics & Reports" /><ReportsManager /></>; }
