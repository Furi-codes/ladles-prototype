/**
 * Selects an icon for portal navigation links.
 * A shared icon mapping gives the desktop and mobile navigation the same symbols.
 */

type Name = "home" | "impact" | "scan" | "profile" | "calendar" | "bell";

export default function PortalNavIcon({ name }: { name: Name }) {
  const paths: Record<Name, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
    impact: <><path d="M4 3v17h17M8 15l4-6 4 3 5-8" /></>,
    scan: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M5 12h14" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
