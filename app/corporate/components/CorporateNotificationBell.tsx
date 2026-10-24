"use client";

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import PortalNavIcon from '@/app/components/PortalNavIcon';
import { useFeatureData } from '@/app/admin/components/FeatureShared';
import { corporateNoticesChanged, corporateUnreadBookingCount } from '@/lib/corporate-notifications';
import ui from '@/app/volunteer/components/notifications.module.css';

/** Same bell presentation as volunteers, backed only by this company's booking notices. */
export default function CorporateNotificationBell() {
  const pathname = usePathname();
  const { data: unread, error, loading, reload } = useFeatureData(corporateUnreadBookingCount);
  const previousPath = useRef(pathname);
  useEffect(() => {
    // The header now persists between routes, so navigation no longer remounts the bell.
    if (previousPath.current !== pathname) { previousPath.current = pathname; void reload(); }
  }, [pathname, reload]);
  useEffect(() => {
    // Refresh when returning to the tab; no volunteer inbox or live subscription is shared.
    const refresh = () => { void reload(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(corporateNoticesChanged, refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener(corporateNoticesChanged, refresh); };
  }, [reload]);
  const label = error ? 'Notifications unavailable. Open notifications to retry.' : loading ? 'Notifications, checking for unread updates' : `Notifications, ${unread === 100 ? '99+' : unread ?? 0} unread`;
  return <Link href="/corporate/updates" className={ui.bell} aria-label={label} aria-current={pathname === '/corporate/updates' ? 'page' : undefined} title="Notifications">
    <PortalNavIcon name="bell" />
    {!loading && !error && Boolean(unread) && <span className={ui.badge}>{unread === 100 ? '99+' : unread}</span>}
  </Link>;
}
