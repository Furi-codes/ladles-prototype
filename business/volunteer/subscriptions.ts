/** The volunteer workspace can observe only the datasets used by its read model. */
import { subscribeToRecords } from '@/data/realtime/subscriptions';

export function watchVolunteerRecords(channel: string, table: 'bookings' | 'events' | 'event_slots' | 'attendance_records' | 'notifications', refresh: () => void, filter?: string) {
  return subscribeToRecords(channel, table, refresh, filter);
}
