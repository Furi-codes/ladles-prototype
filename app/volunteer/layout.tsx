import { VolunteerProvider } from "./components/VolunteerProvider";
import VolunteerShell from "./components/VolunteerShell";

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return <VolunteerProvider><VolunteerShell>{children}</VolunteerShell></VolunteerProvider>;
}
