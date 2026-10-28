/** Company ownership lookup. Filtering is repeated by database policies; this does not grant company membership. */
import { supabase } from '@/data/supabase/client';

export const readOwnedCorporateAccount = (ownerId: string) => supabase.from('corporate_accounts').select('*').eq('owner_user_id', ownerId).maybeSingle();
