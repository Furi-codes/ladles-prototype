/**
 * Verifies the bearer session and saved admin role for server-only routes.
 * The role is read from profiles rather than editable user metadata, and missing/failed checks
 * deny access.
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Authenticate the request on the server before using an admin-only external service. */
export async function requireAdminRequest(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 8192 || !authorization.slice(7).trim()) return Response.json({ error: 'Please sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: 'Account checks are temporarily unavailable.' }, { status: 503 });
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: authorization } } });
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !data.user) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
    const profile = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (profile.error) return Response.json({ error: 'Admin access could not be checked. Please retry.' }, { status: 503 });
    if (profile.data?.role !== 'admin') return Response.json({ error: 'Administrator access is required.' }, { status: 403 });
    return null;
  } catch { return Response.json({ error: 'Admin access could not be checked. Please retry.' }, { status: 503 }); }
}
