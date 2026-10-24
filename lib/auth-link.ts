/** Link errors affect the screen only. Never echo URL descriptions or tokens, or use them as proof of identity. */
export function hasAuthLinkError(search = '', hash = ''): boolean {
  const query = new URLSearchParams(search), fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return query.get('verification')==='expired' || ['error','error_code','error_description'].some(key=>query.has(key)||fragment.has(key));
}
