/**
 * Supplies corporate wording to the shared full-workspace loader.
 * The full animation is reserved for entering the workspace rather than each tab change.
 */

import PortalLoadingScreen from '@/presentation/components/feedback/PortalLoadingScreen';

/** Keep corporate loading identical to the other portals without loading volunteer data. */
export default function CorporateLoadingScreen() {
  return <PortalLoadingScreen message="Ladles of Love is preparing your corporate portal…" />;
}
