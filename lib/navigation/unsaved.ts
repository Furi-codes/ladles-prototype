/**
 * Coordinates dirty-form checks for links, history navigation and form registration.
 * A shared registry allows one navigation decision even when several components have unsaved
 * state.
 */

const dirtyForms = new Set<symbol>();
let stopWatching: (() => void) | undefined;

export function confirmUnsavedNavigation() {
  return dirtyForms.size === 0 || window.confirm('Discard your unsaved changes and leave this form?');
}

/** Do not patch Next's history state: it contains the router's own navigation data. */
export function watchUnsavedNavigation(confirm: () => boolean) {
  const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
  const followLink = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
      link.target && link.target !== '_self' || link.hasAttribute('download')) return;
    const href = link.getAttribute('href') ?? '';
    if (!href || /^(#|mailto:|tel:)/i.test(href)) return;
    const destination = new URL(href, window.location.href);
    if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (!confirm()) { event.preventDefault(); event.stopPropagation(); }
  };
  // Modern browsers can cancel same-document Back/Forward before the page disappears.
  // Older browsers have no cancellable SPA popstate event; beforeunload still covers page exit.
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  const traverse = (event: Event) => {
    const next = event as Event & { navigationType?: string; hashChange?: boolean; destination?: { sameDocument: boolean } };
    if (next.navigationType === 'traverse' && !next.hashChange && next.destination?.sameDocument && next.cancelable && !next.defaultPrevented && !confirm()) next.preventDefault();
  };
  window.addEventListener('beforeunload', leave);
  document.addEventListener('click', followLink, true);
  navigation?.addEventListener('navigate', traverse);
  return () => {
    window.removeEventListener('beforeunload', leave);
    document.removeEventListener('click', followLink, true);
    navigation?.removeEventListener('navigate', traverse);
  };
}

export function registerUnsavedForm() {
  const id = Symbol('unsaved form');
  dirtyForms.add(id);
  if (!stopWatching) stopWatching = watchUnsavedNavigation(confirmUnsavedNavigation);
  return () => {
    dirtyForms.delete(id);
    if (dirtyForms.size === 0) { stopWatching?.(); stopWatching = undefined; }
  };
}
