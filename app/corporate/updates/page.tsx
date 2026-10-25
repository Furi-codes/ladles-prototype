/**
 * Opens the company inbox at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import CorporateWorkflowPortal from '@/features/corporate/shell/CorporateWorkflowPortal';
export default function CorporateUpdatesPage() { return <CorporateWorkflowPortal mode="updates" />; }
