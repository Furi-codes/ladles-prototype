/** Shared Lucide symbols for task navigation; labels remain on the links themselves. */
import { House, ChartNoAxesCombined, ScanLine, UserRound, CalendarDays, Bell } from 'lucide-react';

const icons = { home: House, impact: ChartNoAxesCombined, scan: ScanLine, profile: UserRound, calendar: CalendarDays, bell: Bell };
export default function PortalNavIcon({ name }: { name: keyof typeof icons }) {
  const Symbol = icons[name];
  return <Symbol size={20} strokeWidth={1.7} aria-hidden="true" />;
}
