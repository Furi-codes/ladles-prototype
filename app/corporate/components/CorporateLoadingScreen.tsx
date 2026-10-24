import PortalLoadingScreen from '@/app/components/PortalLoadingScreen';

/** Keep corporate loading identical to the other portals without loading volunteer data. */
export default function CorporateLoadingScreen() {
  return <PortalLoadingScreen message="Ladles of Love is preparing your corporate portal…" />;
}
