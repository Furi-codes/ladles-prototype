/**
 * Uses the common loading animation for the volunteer workspace.
 * Only the portal wording is specific here; the shared component owns the visual layout.
 */

import PortalLoadingScreen from "@/presentation/components/feedback/PortalLoadingScreen";

export default function VolunteerLoadingScreen({ message = "Loading volunteer portal..." }: { message?: string }) {
  return <PortalLoadingScreen message={message === "Loading volunteer portal..." || message === "Checking volunteer access..." ? "Ladles of Love is preparing your volunteer portal…" : message} />;
}
