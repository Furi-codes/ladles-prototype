/**
 * Renders the text brand and portal label used in workspace headers.
 * All roles use this component so the header branding stays consistent without stretching an
 * image.
 */

import styles from '@/presentation/components/branding/PortalBrand.module.css';
import { HeartHandshake } from 'lucide-react';

/** All portals share a compact text brand; the full logo stays on the sign-in screen. */
export default function PortalBrand({ portal }: { portal: 'Administration' | 'Volunteer portal' | 'Corporate portal' }) {
  return <span className={styles.brand}><span className={styles.mark} aria-hidden="true"><HeartHandshake size={23} strokeWidth={1.65} /></span><span className={styles.wordmark}>
    <strong className={styles.name}>LADLES OF LOVE</strong>
    <span className={styles.portal}>{portal}</span>
  </span></span>;
}
