/**
 * Creates the shared browser Supabase client and current-user helper.
 * Only the public project configuration belongs here; privileged integration credentials belong
 * in server-only code.
 */

import { createClient } from '@supabase/supabase-js'

// Public Supabase configuration exposed to browser code by Next.js.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Fail early so the app does not run with an unusable database client.
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.')
}

// This public key does not grant admin access by itself. Database permissions and RLS
// must still restrict requests using the signed-in user's session.
export const supabase = createClient(supabaseUrl, supabaseKey)

/** Asks Supabase Auth for the session's user; this helper returns only the user, not the error. */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
