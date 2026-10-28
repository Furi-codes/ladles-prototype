/** Application-facing account operations. Forms keep UI state; password/account policies are handled by business services. */
import { getAuthenticatedUser } from '@/data/auth/session';

export {
  getAuthenticatedUser, getAccountSession, signInAccount, registerAccount,
  updateAuthenticatedUser, sendRecoveryEmail, resendVerification,
  signInWithProvider, signOutAccount, observeAccountSession,
} from '@/data/auth/session';
export { findSignInProfile } from '@/data/profiles/repository';

/** Preserve the existing access-guard contract, which returns the user rather than the Auth envelope. */
export async function getCurrentUser() {
  const { data: { user } } = await getAuthenticatedUser();
  return user;
}
