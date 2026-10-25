/**
 * Adds one-time scroll entrances to each portal using browser animations.
 * Nothing is hidden in CSS while waiting for JavaScript. Cancelling an animation
 * restores the normal layout, including when printing or reducing motion.
 */

export function installPortalMotion(root: HTMLElement, selector: string): () => void {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view || typeof view.matchMedia !== 'function') return () => {};

  const preference = view.matchMedia('(prefers-reduced-motion: reduce)');
  const content = root.querySelector<HTMLElement>('main');
  const active = new Map<HTMLElement, Animation>();
  const seen = new WeakSet<HTMLElement>();
  let intersection: IntersectionObserver | null = null;
  let mutations: MutationObserver | null = null;
  let frame = 0;
  let collectionPending = false;
  let printing = false;
  let disposed = false;

  function cancelAnimations() {
    for (const animation of active.values()) animation.cancel();
    active.clear();
  }

  /** Fade from soft focus without moving the surface; release the filter when it finishes. */
  function reveal(element: HTMLElement, index: number) {
    if (seen.has(element) || preference.matches || printing || disposed) return;
    seen.add(element);
    if (element.contains(document.activeElement) || typeof element.animate !== 'function') return;
    try {
      const animation = element.animate([
        { opacity: .15, filter: 'blur(5px)', offset: 0 },
        { opacity: .85, filter: 'blur(1px)', offset: .55 },
        { opacity: 1, filter: 'none', offset: 1 },
      ], {
        duration: 520,
        delay: Math.min(index, 3) * 40,
        easing: 'cubic-bezier(.22, .61, .36, 1)',
        fill: 'both',
      });
      active.set(element, animation);
      animation.onfinish = () => { active.delete(element); animation.cancel(); };
      animation.oncancel = () => { active.delete(element); };
    } catch {
      // Animation support must never decide whether a form or its data is visible.
    }
  }

  function collect() {
    if (!content || !intersection) return;
    for (const element of content.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(element) || element.closest('[hidden], dialog, [role="dialog"]')) continue;
      // Reveal the outer surface once rather than blurring every nested field/card too.
      const parent = element.parentElement?.closest(selector);
      if (parent && content.contains(parent)) continue;
      intersection.observe(element);
    }
  }

  function update() {
    frame = 0;
    if (disposed) return;
    const page = document.documentElement;
    const distance = page.scrollHeight - page.clientHeight;
    const progress = distance > 0 ? Math.min(1, Math.max(0, view!.scrollY / distance)) : 0;
    root.style.setProperty('--portal-scroll-progress', String(progress));
    // Scrolling updates one decorative variable; rescan cards only after DOM changes.
    if (collectionPending) { collectionPending = false; collect(); }
  }

  function schedule() {
    if (!disposed && !frame) frame = view!.requestAnimationFrame(update);
  }

  function scheduleCollection() {
    collectionPending = true;
    schedule();
  }

  function stop() {
    intersection?.disconnect(); intersection = null;
    mutations?.disconnect(); mutations = null;
    cancelAnimations();
  }

  function start() {
    stop();
    if (disposed || preference.matches || printing || !content) return;
    if (typeof view!.IntersectionObserver !== 'function') return;
    intersection = new view!.IntersectionObserver(entries => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        intersection?.unobserve(element);
        reveal(element, index++);
      }
    }, { threshold: .01, rootMargin: '0px 0px -16px 0px' });
    if (typeof view!.MutationObserver === 'function') {
      mutations = new view!.MutationObserver(records => {
        // Ignore text-only changes (such as live attendance clocks).
        if (records.some(record => record.type === 'attributes' ||
          Array.from(record.addedNodes).some(node => node.nodeType === 1))) scheduleCollection();
      });
      mutations.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
    collect();
  }

  function beforePrint() { printing = true; stop(); }
  function afterPrint() { printing = false; start(); schedule(); }
  function interact(event: Event) {
    // Clear an entrance immediately when someone focuses or clicks a control inside it.
    if (!event.target || typeof (event.target as Element).closest !== 'function') return;
    for (const [element, animation] of active) {
      if (element.contains(event.target as Node)) animation.cancel();
    }
  }

  start();
  schedule();
  preference.addEventListener('change', start);
  view.addEventListener('scroll', schedule, { passive: true });
  view.addEventListener('resize', schedule);
  view.addEventListener('beforeprint', beforePrint);
  view.addEventListener('afterprint', afterPrint);
  root.addEventListener('focusin', interact);
  root.addEventListener('pointerdown', interact);

  return () => {
    disposed = true; stop();
    if (frame) view.cancelAnimationFrame(frame);
    root.style.removeProperty('--portal-scroll-progress');
    preference.removeEventListener('change', start);
    view.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', schedule);
    view.removeEventListener('beforeprint', beforePrint);
    view.removeEventListener('afterprint', afterPrint);
    root.removeEventListener('focusin', interact);
    root.removeEventListener('pointerdown', interact);
  };
}
