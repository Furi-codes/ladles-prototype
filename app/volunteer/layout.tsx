/**
 * Wraps volunteer routes in their shared provider and workspace shell.
 * Bookings, profile and notifications are shared across child pages through this persistent
 * layout.
 */

import { VolunteerProvider } from "@/presentation/volunteer/shell/VolunteerProvider";
import VolunteerShell from "@/presentation/volunteer/shell/VolunteerShell";

/** Gives the shell and all child pages access to the same VolunteerProvider context. */
export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return <VolunteerProvider><VolunteerShell>{children}</VolunteerShell></VolunteerProvider>;
}
