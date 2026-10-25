/** Shared by registration, recovery and account settings. Sign-in deliberately accepts existing passwords. */
export const passwordRequirements = 'Use 8–128 characters, including an uppercase letter, a lowercase letter, a number and a symbol.';

export function passwordError(password: string): string {
  if (password.length < 8 || password.length > 128) return passwordRequirements;
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,./`~]/.test(password)) return passwordRequirements;
  return '';
}
