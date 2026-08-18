// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Get keys from environment variables (safer!)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a single instance to use across your app
export const supabase = createClient(supabaseUrl, supabaseKey)