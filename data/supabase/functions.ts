/** Sends named database operations. Workflow validation stays in the business layer; SQL repeats access and integrity checks. */
import { supabase } from '@/data/supabase/client';

export function invokeDatabaseFunction(name: string, args: Record<string, unknown> = {}) {
  return supabase.rpc(name, args);
}
