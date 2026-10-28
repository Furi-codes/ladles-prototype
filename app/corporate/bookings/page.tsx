/**
 * Opens the company bookings at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import CorporateWorkflowPortal from '@/presentation/corporate/shell/CorporateWorkflowPortal';
export default function CorporateBookingsPage() { return <CorporateWorkflowPortal mode="bookings" />; }
