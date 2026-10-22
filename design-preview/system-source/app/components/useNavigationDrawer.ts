"use client";

import { useEffect, useEffectEvent } from "react";

/** Keep mobile navigation keyboard accessible and release scrolling on close/unmount. */
export function useNavigationDrawer(open: boolean, close: () => void, panelId: string, breakpoint: number) {
  const closeMenu = useEffectEvent(close);
  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMenu(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const desktop = window.matchMedia(`(min-width: ${breakpoint + 1}px)`);
    const resize = () => { if (desktop.matches) closeMenu(); };
    document.addEventListener("keydown", keydown);
    desktop.addEventListener("change", resize);
    resize();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      desktop.removeEventListener("change", resize);
      if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
    };
  }, [open, panelId, breakpoint]);
}
