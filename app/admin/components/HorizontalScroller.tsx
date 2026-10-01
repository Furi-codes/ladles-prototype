"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import visual from "./analytics.module.css";

export default function HorizontalScroller({ children, label }: { children: ReactNode; label: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [maximum, setMaximum] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      const nextMaximum = Math.max(0, element.scrollWidth - element.clientWidth);
      setMaximum(nextMaximum);
      setPosition(Math.min(element.scrollLeft, nextMaximum));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  function move(next: number) {
    viewport.current?.scrollTo({ left: next });
    setPosition(next);
  }

  return <div className={visual.scroller}>
    <div ref={viewport} className={visual.eventHeatmapWrap} tabIndex={0} role="region" aria-label={`${label}. Scroll horizontally to view additional events.`} onScroll={event => setPosition(event.currentTarget.scrollLeft)}>{children}</div>
    {maximum > 0 && <label className={visual.horizontalScrollControl}><span>More events</span><input type="range" min="0" max={maximum} value={position} step="1" aria-label={`Scroll ${label} horizontally`} onChange={event => move(Number(event.target.value))} /><span aria-hidden="true">→</span></label>}
  </div>;
}
