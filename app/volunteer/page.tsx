/**
 * Opens the volunteer dashboard at its Next.js route.
 * The route delegates to feature components, keeping URL structure separate from the larger
 * screen implementation.
 */

import VolunteerDashboard from "@/presentation/volunteer/dashboard/VolunteerDashboard";

export default function VolunteerPage() {
  return <VolunteerDashboard />;
}
