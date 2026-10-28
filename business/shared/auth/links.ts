/**
 * Detects authentication errors returned in email-link URLs.
 * Callers show a safe explanation instead of displaying raw URL contents that may include
 * tokens.
 */

export function hasAuthLinkError(search = '', hash = ''): boolean {
  const query = new URLSearchParams(search), fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return query.get('verification')==='expired' || ['error','error_code','error_description'].some(key=>query.has(key)||fragment.has(key));
}
