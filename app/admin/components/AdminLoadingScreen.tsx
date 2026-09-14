import PortalLoadingScreen from "@/app/components/PortalLoadingScreen";

export default function AdminLoadingScreen({ message = "Loading administration..." }: { message?: string }) {
  return <PortalLoadingScreen message={message === "Loading administration..." ? "Ladles of Love is preparing the administration portal…" : message} />;
}
