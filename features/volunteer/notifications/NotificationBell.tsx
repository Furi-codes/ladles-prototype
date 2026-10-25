"use client";
/**
 * Opens the volunteer inbox and displays its unread count.
 * It reads shared inbox state so the count changes after a message is marked read.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { unreadNotifications } from "@/features/volunteer/utils/notifications";
import { useVolunteerData } from "@/features/volunteer/shell/VolunteerProvider";
import ui from "@/features/volunteer/notifications/notifications.module.css";

export default function NotificationBell() {
  const { notifications, notificationError } = useVolunteerData();
  const count = unreadNotifications(notifications);
  const pathname = usePathname();
  return <Link href="/volunteer/notifications" className={ui.bell} aria-current={pathname === "/volunteer/notifications" ? "page" : undefined} aria-label={notificationError ? "Notifications unavailable. Open inbox to retry." : `Notifications, ${count} unread`} title="Notifications">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
    {count > 0 && <span className={ui.badge}>{count > 99 ? "99+" : count}</span>}
  </Link>;
}
