"use client";

/**
 * Lists volunteer notices with read actions and links to relevant shifts.
 * The inbox keeps messages after they are read and updates local state only for confirmed read
 * updates.
 */

import Link from "next/link";
import { useRef, useState } from "react";
import type { Event } from "@/business/shared/types";
import { inboxItems, notificationDate, notificationLabel, unreadNotifications } from "@/business/volunteer/notifications";
import styles from "@/presentation/styles/volunteer.module.css";
import ui from "@/presentation/volunteer/notifications/notifications.module.css";
import { useVolunteerData } from "@/presentation/volunteer/shell/VolunteerProvider";
import EventModal from "@/presentation/volunteer/events/EventModal";

export default function NotificationPanel({ compact = false }: { compact?: boolean }) {
  const { notifications, notificationsLoading, notificationError, refreshNotifications, dismissNotification, markAllNotificationsRead, events, eventSlots, bookings, profile, createUserBooking } = useVolunteerData();
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [visible, setVisible] = useState(10);
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const pending = useRef(false);
  const [actionError, setActionError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const unread = unreadNotifications(notifications);
  const items = inboxItems(notifications, unreadOnly);

  async function markRead(id?: number) {
    if (pending.current) return; pending.current = true;
    setActionError('');
    setBusy(id ?? "all");
    try { if (id === undefined) await markAllNotificationsRead(); else await dismissNotification(id); }
    catch { setActionError('Notifications could not be marked as read. Please try again.'); }
    finally { pending.current = false; setBusy(null); }
  }

  if (compact) {
    if (!notificationError && unread === 0) return null;
    return <section className={`${styles.card} ${ui.summary}`} aria-label="Notifications">
      <div><strong>{notificationError ? "Notifications unavailable" : `${unread} unread update${unread === 1 ? "" : "s"}`}</strong><p className={styles.cardHint}>{notificationError ? "Open your inbox to retry." : "Check your event updates and shift reminders."}</p></div>
      <Link href="/volunteer/notifications" className={styles.secondaryButton}>View notifications</Link>
    </section>;
  }

  return <>
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h2 className={styles.cardTitle}>Your inbox</h2><p className={styles.cardHint}>Event updates and reminders. Marking read keeps the message in your history.</p></div><div className={ui.actions}><button type="button" disabled={notificationsLoading || busy !== null} className={styles.secondaryButton} onClick={() => void refreshNotifications()}>Refresh</button><button type="button" disabled={notificationsLoading || busy !== null || unread === 0 || Boolean(notificationError)} className={styles.secondaryButton} onClick={() => void markRead()}>{busy === "all" ? "Updating..." : "Mark all as read"}</button></div></div>
      <div className={ui.filters} aria-label="Inbox filter">{[true, false].map(value => <button type="button" key={String(value)} className={value === unreadOnly ? styles.primaryButton : styles.secondaryButton} aria-pressed={value === unreadOnly} onClick={() => { setUnreadOnly(value); setVisible(10); }}>{value ? `Unread (${unread})` : `All (${notifications.length})`}</button>)}<Link href="/volunteer/profile#notification-preferences" className={styles.secondaryButton}>Notification settings</Link></div>
      {actionError && <div className={ui.error} role="alert">{actionError}</div>}
      {notificationError && <div className={ui.error} role="alert">{notificationError} <button className={styles.secondaryButton} onClick={() => void refreshNotifications()} disabled={notificationsLoading}>Try again</button></div>}
      {notificationsLoading && notifications.length === 0 ? <p className={ui.empty} role="status">Loading your notifications...</p> : !notificationError && items.length === 0 ? <div className={ui.empty}><strong>{unreadOnly ? "You’re all caught up" : "No notifications yet"}</strong><p>Event updates and shift reminders will appear here.</p></div> : <div>
        {items.slice(0, visible).map(notification => {
          const event = events.find(item => item.id === notification.event_id);
          const canView = event && event.status !== "Cancelled" && bookings.some(booking => booking.event_id === event.id && booking.user_id === profile?.id);
          return <article key={notification.id} className={`${ui.item} ${!notification.is_read ? ui.unread : ""}`}>
            <div className={ui.meta}><span className={ui.tag}>{notificationLabel(notification.type)}</span><time dateTime={notification.created_at}>{notificationDate(notification.created_at)}</time>{!notification.is_read && <span className={ui.dot} aria-label="Unread" />}</div>
            <h3 className={ui.title}>{notification.title}</h3>{notification.message && <p className={ui.message}>{notification.message}</p>}
            {event && <p className={styles.cardHint}>{event.title} · {event.date} · {event.location}</p>}
            <div className={ui.actions}>
              {notification.type === "event_cancelled" || event?.status === "Cancelled" ? <Link className={styles.secondaryButton} href="/volunteer">Find other opportunities</Link> : canView ? <button className={styles.secondaryButton} onClick={() => setSelectedEvent(event)}>View booked shift</button> : <Link className={styles.secondaryButton} href="/volunteer/impact">View my history</Link>}
              {!notification.is_read && <button type="button" disabled={busy !== null} className={styles.secondaryButton} onClick={() => void markRead(notification.id)}>{busy === notification.id ? "Updating..." : "Mark read"}</button>}
            </div>
          </article>;
        })}
      </div>}
      {items.length > visible && <div className={ui.filters}><button type="button" className={styles.secondaryButton} onClick={() => setVisible(value => value + 10)}>Show more</button></div>}
    </section>
    {selectedEvent && <EventModal event={events.find(event => event.id === selectedEvent.id) ?? null} eventSlots={eventSlots.filter(slot => slot.event_id === selectedEvent.id)} bookings={bookings} profile={profile} onClose={() => setSelectedEvent(null)} onBook={createUserBooking} />}
  </>;
}
