/** Admin activity-log helpers used after successful management operations and by Settings. */
import { supabase } from '@/lib/supabase';

/** A stored action with its actor, affected record, optional details and timestamp. */
export type AdminAuditEntry = {
  id: number;
  admin_id: string | null;
  admin_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

/** Caller-supplied action details; the database RPC supplies the administrator identity. */
type AuditAction = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  entityLabel?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Requests an audit entry after a successful action. Returned RPC errors are
 * logged instead of thrown; an unexpected rejected request is not caught here.
 */
export async function logAdminAction({
  action,
  entityType,
  entityId = null,
  entityLabel = null,
  details = {},
}: AuditAction): Promise<void> {
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId === null ? null : String(entityId),
    p_entity_label: entityLabel,
    p_details: details,
  });

  if (error) {
    console.error('Unable to record administrator audit action:', error);
  }
}

/** Loads the latest limited activity list, not the complete audit history; errors are thrown to the UI. */
export async function loadAdminAuditLog(limit = 20): Promise<AdminAuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminAuditEntry[];
}
