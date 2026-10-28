/**
 * Uses the shared loading screen for the admin workspace.
 * The wrapper supplies admin wording while the common component owns the animation.
 */

import PortalLoadingScreen from "@/presentation/components/feedback/PortalLoadingScreen";

export default function AdminLoadingScreen({ message = "Loading administration..." }: { message?: string }) {
  return <PortalLoadingScreen message={message === "Loading administration..." ? "Ladles of Love is preparing the administration portal…" : message} />;
}
