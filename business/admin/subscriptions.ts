/** Admin read models refresh when their underlying volunteer records change. Subscriptions never grant write permissions. */
import { subscribeToRecords } from '@/data/realtime/subscriptions';
export const watchAdminRecords = (channel: string, table: 'bookings' | 'events' | 'event_slots' | 'attendance_records', refresh: () => void) => subscribeToRecords(channel, table, refresh);
