/** Realtime is a read-refresh signal. It does not save bookings or create reminder records. */
import { supabase } from '@/data/supabase/client';

export function subscribeToRecords(channel: string, table: string, refresh: () => void, filter?: string) {
  return supabase.channel(channel).on('postgres_changes', {
    event: '*', schema: 'public', table, ...(filter ? { filter } : {}),
  }, refresh).subscribe();
}
