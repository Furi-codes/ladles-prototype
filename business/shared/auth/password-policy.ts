/**
 * Checks the password rules shared by registration, recovery and account changes.
 * Existing passwords are not revalidated during normal sign-in, so test accounts can still log
 * in.
 */

export const passwordRequirements = 'Use 8–128 characters, including an uppercase letter, a lowercase letter, a number and a symbol.';

/**
 * Return the first unmet new-password rule or null. Keeping this shared makes signup, reset and
 * account changes use the same rules.
 */
export function passwordError(password: string): string {
  if (password.length < 8 || password.length > 128) return passwordRequirements;
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,./`~]/.test(password)) return passwordRequirements;
  return '';
}
