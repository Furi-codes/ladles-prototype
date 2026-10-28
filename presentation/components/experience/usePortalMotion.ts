"use client";

/**
 * Keeps portal motion local to the persistent shell. A route change gets a fresh
 * entrance, while the existing provider, form state and navigation remain intact.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { installPortalMotion } from '@/presentation/components/experience/portal-motion';
import styles from '@/presentation/styles/admin.module.css';
import visual from '@/presentation/admin/analytics/analytics.module.css';
import volunteer from '@/presentation/styles/volunteer.module.css';
import experience from '@/presentation/styles/experience.module.css';

const surfaces = [styles.card, volunteer.card, visual.metric, experience.stat].map(className => `.${className}`).join(',');
const entrances = [surfaces, `.${styles.pageHeading}`, `.${volunteer.pageHeading}`, `.${styles.pageTitle}`, '[data-reveal]'].join(',');

export function usePortalMotion(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (!enabled || !root.current) return;
    return installPortalMotion(root.current, entrances);
  }, [enabled, path]);
  return root;
}
