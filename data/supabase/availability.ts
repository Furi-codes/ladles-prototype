/**
 * Loads aggregate remaining places for volunteer slots.
 * The aggregate RPC supplies capacity without exposing other volunteers' private booking rows.
 */

import { supabase } from '@/data/supabase/client';
import type { SlotAvailability } from '@/business/shared/types';

/** Read remaining places without exposing other volunteers' booking details. */
export async function fetchSlotAvailability(): Promise<SlotAvailability[] | null> {
  const { data, error } = await supabase.rpc('get_slot_availability');
  if (error?.code === 'PGRST202') return null;
  if (error) throw new Error(error.message);
  return data as SlotAvailability[];
}
