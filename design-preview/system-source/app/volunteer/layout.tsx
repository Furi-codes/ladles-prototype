/** Volunteer routes share their account/data state and navigation shell through this wrapper. */
import { VolunteerProvider } from "./components/VolunteerProvider";
import VolunteerShell from "./components/VolunteerShell";

/** Gives the shell and all child pages access to the same VolunteerProvider context. */
export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return <VolunteerProvider><VolunteerShell>{children}</VolunteerShell></VolunteerProvider>;
}
