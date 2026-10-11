/** Display helpers for notifications already loaded by the volunteer provider; no delivery happens here. */
import type { Notification } from "./types";

/** Gives reminder notices a shorter label, with cancellation notices shown as event updates. */
export function notificationLabel(type: Notification["type"]): string {
  if (type === "shift_reminder_24h") return "Upcoming shift";
  if (type === "shift_reminder_2h") return "Starting soon";
  return "Event update";
}

/** Returns a new, newest-first list, optionally excluding read notices. IDs break timestamp ties. */
export function inboxItems(items: Notification[], unreadOnly: boolean): Notification[] {
  return items.filter(item => !unreadOnly || !item.is_read).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
}

/** Counts unread loaded records for the bell badge; this does not query the database. */
export function unreadNotifications(items: Notification[]): number {
  return items.filter(item => !item.is_read).length;
}

/** Formats a notice timestamp in South African time, with a fallback for invalid dates. */
export function notificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
