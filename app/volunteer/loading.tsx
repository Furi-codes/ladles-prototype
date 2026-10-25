/**
 * Supplies the Next.js loading fallback for this portal route.
 * The portal-specific wrapper reuses the shared loading presentation.
 */

import VolunteerLoadingScreen from "@/features/volunteer/shell/VolunteerLoadingScreen";

export default function VolunteerLoading() {
  return <VolunteerLoadingScreen message="Loading volunteer portal..." />;
}
