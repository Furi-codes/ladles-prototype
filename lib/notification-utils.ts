import type { Notification } from "./types";

export function notificationLabel(type: Notification["type"]): string {
  if (type === "shift_reminder_24h") return "Upcoming shift";
  if (type === "shift_reminder_2h") return "Starting soon";
  return "Event update";
}

export function inboxItems(items: Notification[], unreadOnly: boolean): Notification[] {
  return items.filter(item => !unreadOnly || !item.is_read).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
}

export function unreadNotifications(items: Notification[]): number {
  return items.filter(item => !item.is_read).length;
}

export function notificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
