import styles from './PortalBrand.module.css';

/** All portals share a compact text brand; the full logo stays on the sign-in screen. */
export default function PortalBrand({ portal }: { portal: 'Administration' | 'Volunteer portal' | 'Corporate portal' }) {
  return <span className={styles.brand}>
    <strong className={styles.name}>LADLES OF LOVE</strong>
    <span className={styles.portal}>{portal}</span>
  </span>;
}
