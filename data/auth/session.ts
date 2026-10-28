/** The only browser Auth adapter. Callers use named operations rather than receiving the Supabase client. */
import { supabase } from '@/data/supabase/client';

export const getAuthenticatedUser = (...args: Parameters<typeof supabase.auth.getUser>) => supabase.auth.getUser(...args);
export const getAccountSession = () => supabase.auth.getSession();
export const signInAccount = (...args: Parameters<typeof supabase.auth.signInWithPassword>) => supabase.auth.signInWithPassword(...args);
export const registerAccount = (...args: Parameters<typeof supabase.auth.signUp>) => supabase.auth.signUp(...args);
export const updateAuthenticatedUser = (...args: Parameters<typeof supabase.auth.updateUser>) => supabase.auth.updateUser(...args);
export const sendRecoveryEmail = (...args: Parameters<typeof supabase.auth.resetPasswordForEmail>) => supabase.auth.resetPasswordForEmail(...args);
export const resendVerification = (...args: Parameters<typeof supabase.auth.resend>) => supabase.auth.resend(...args);
export const signInWithProvider = (...args: Parameters<typeof supabase.auth.signInWithOAuth>) => supabase.auth.signInWithOAuth(...args);
export const signOutAccount = () => supabase.auth.signOut();
/** Supabase accepts synchronous or asynchronous listeners; keep both overloads available to the UI hooks. */
export const observeAccountSession = (listener: (event: import('@supabase/supabase-js').AuthChangeEvent, session: import('@supabase/supabase-js').Session | null) => void | Promise<void>) => supabase.auth.onAuthStateChange(listener);
