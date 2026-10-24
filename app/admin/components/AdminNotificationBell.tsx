"use client";

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import PortalNavIcon from '@/app/components/PortalNavIcon';
import { loadAdminNoticeBadge } from '@/lib/admin-notifications';
import { useAdminNoticeData } from './useAdminNoticeData';
import styles from '@/app/volunteer/components/notifications.module.css';

export default function AdminNotificationBell() {
  const path = usePathname(), previous = useRef(path);
  const { data, loading, error, reload } = useAdminNoticeData(loadAdminNoticeBadge);
  useEffect(() => { if (previous.current!==path) { previous.current=path; void reload(); } }, [path, reload]);
  const unread = data?.unread_total ?? 0;
  const label = error ? 'Admin notifications unavailable. Open notifications to retry.' : loading ? 'Admin notifications, checking unread updates' : `Admin notifications, ${unread} unread`;
  return <Link href="/admin/notifications" className={styles.bell} aria-label={label} aria-current={path==='/admin/notifications' ? 'page' : undefined} title="Admin notifications"><PortalNavIcon name="bell" />{!loading && !error && unread>0 && <span className={styles.badge}>{unread>99 ? '99+' : unread}</span>}</Link>;
}
