"use client";

/**
 * Places the shared personal reminder controls in the volunteer profile.
 * The reusable control keeps volunteer and corporate reminder settings consistent.
 */

import PersonalReminderPreferences from '@/presentation/components/notifications/PersonalReminderPreferences';

export default function NotificationPreferences() {
  return <PersonalReminderPreferences portal="volunteer" />;
}
