"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PortalNavIcon from '@/app/components/PortalNavIcon';
import { corporateBookingsEnabled, corporateOutcomesEnabled } from '@/lib/feature-flags';
import volunteer from '@/app/volunteer/volunteer.module.css';

/** Same desktop and mobile navigation styles as volunteers, with company-only destinations. */
export default function CorporateNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: '/corporate/bookings', label: 'My bookings', icon: 'home' },
    { href: '/corporate/events', label: 'Browse events', icon: 'calendar' },
    ...(corporateOutcomesEnabled ? [{ href: '/corporate/reports', label: 'Group reports', icon: 'impact' } as const] : []),
  ] as const;
  if (!corporateBookingsEnabled) return null;
  return <nav className={mobile ? volunteer.bottomNavigation : volunteer.desktopNavigation} style={mobile ? { gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` } : undefined} aria-label={mobile ? 'Mobile corporate navigation' : 'Corporate navigation'}>
    {links.map(({ href, label, icon }) => <Link key={href} href={href} className={volunteer.portalNavLink} aria-current={pathname === href ? 'page' : undefined}>{mobile && <PortalNavIcon name={icon} />}<span>{label}</span></Link>)}
  </nav>;
}
