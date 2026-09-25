import { supabase } from '@/lib/supabase';

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

type AuditAction = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  entityLabel?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Records a successful administrator action. Logging must never undo an
 * already-completed user action if the audit service is temporarily unavailable.
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

export async function loadAdminAuditLog(limit = 20): Promise<AdminAuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminAuditEntry[];
}
