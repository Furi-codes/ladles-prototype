/**
 * Normalises and checks the phone-number input used by forms.
 * Phone validation checks the saved format; it does not verify that the number belongs to the
 * person.
 */

export function normalisePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** The database uses the same format/digit limits. A valid format is not proof the number is reachable. */
export function isValidPhone(value: string): boolean {
  const phone = normalisePhone(value);
  const digits = phone.replace(/\D/g, '');
  return phone.length <= 25 && /^\+?[0-9][0-9(). -]*[0-9]$/.test(phone) && digits.length >= 7 && digits.length <= 15;
}
