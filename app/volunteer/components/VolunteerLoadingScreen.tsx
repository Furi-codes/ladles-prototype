import PortalLoadingScreen from "@/app/components/PortalLoadingScreen";

export default function VolunteerLoadingScreen({ message = "Loading volunteer portal..." }: { message?: string }) {
  return <PortalLoadingScreen message={message === "Loading volunteer portal..." || message === "Checking volunteer access..." ? "Ladles of Love is preparing your volunteer portal…" : message} />;
}
