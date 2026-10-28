"use client";

/**
 * Animate the visual total, keeping the actual value available to screen readers and print.
 * The underlying report value is never changed by the decorative count-up.
 */
import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import styles from '@/presentation/components/experience/experience.module.css';

export default function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const label = Number.isFinite(value) ? value.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';
  const output = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !output.current || !Number.isFinite(value)) { previous.current = Number.isFinite(value) ? value : 0; return; }
    const element = output.current;
    const start = previous.current;
    const animation = animate(start, value, { duration: 1.1, ease: [.16, 1, .3, 1], onUpdate: latest => {
      element.textContent = latest.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } });
    previous.current = value;
    return () => { animation.stop(); element.textContent = label; };
  }, [value, decimals, label, reduced]);
  return <><span ref={output} className={styles.numberVisual} aria-hidden="true" data-count-visual>{label}</span><span className={styles.srOnly} data-count-value>{label}</span></>;
}
