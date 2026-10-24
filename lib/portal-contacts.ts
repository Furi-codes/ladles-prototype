import { isValidPhone, normalisePhone } from './contact-details';

export type ContactPortal = 'volunteer' | 'corporate';
export interface PortalContact { kind: 'email' | 'phone'; label: string; value: string; is_primary: boolean }
export interface PortalContactSettings { portal: ContactPortal; version: number; contacts: PortalContact[] }
export const portalContactsChanged = 'portal-contacts-changed';

/** The database repeats these checks. Client validation gives a useful message before saving. */
export function cleanPortalContacts(input: PortalContact[]): PortalContact[] {
  if (!Array.isArray(input) || input.length > 12) throw new Error('Add at most 12 contact methods per portal.');
  const seen = new Set<string>();
  const result = input.map(contact => {
    if (!contact || !['email','phone'].includes(contact.kind) || typeof contact.label !== 'string' || typeof contact.value !== 'string' || typeof contact.is_primary !== 'boolean') throw new Error('Complete each contact method.');
    const label = contact.label.trim(), value = normalisePhone(contact.value);
    if (!label || label.length > 80 || !value || (contact.kind === 'email' ? value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : !isValidPhone(value))) throw new Error('Enter a label and a valid email address or phone number.');
    const key = contact.kind + ':' + (contact.kind === 'email' ? value.toLowerCase() : value.replace(/\D/g,''));
    if (seen.has(key)) throw new Error('Remove duplicate contact methods.');
    seen.add(key);
    return { kind: contact.kind, label, value, is_primary: contact.is_primary };
  });
  for (const kind of ['email','phone']) {
    const group = result.filter(contact => contact.kind === kind);
    if (group.length && group.filter(contact => contact.is_primary).length !== 1) throw new Error('Choose one primary email and one primary phone for each kind you add.');
  }
  return result;
}
