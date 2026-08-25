import { createClient } from '@supabase/supabase-js'

// Public Supabase configuration exposed to browser code by Next.js.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Fail early so the app does not run with an unusable database client.
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.')
}

// Shared Supabase client used by the app's data-access functions.
export const supabase = createClient(supabaseUrl, supabaseKey)

/** Returns the authenticated user for the current browser session, if any. */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Returns the current user's matching record from the `profiles` table. */
export async function getCurrentUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
