/** Skeletons describe loading without suggesting invented figures or replacing existing data. */
import { LoaderCircle } from 'lucide-react';
import styles from '@/presentation/components/experience/experience.module.css';

export default function LoadingState({ label = 'Preparing your workspace…', compact = false }: { label?: string; compact?: boolean }) {
  return <div className={compact ? styles.loadingCompact : styles.loadingState} role="status" aria-label={label}>
    <span className={styles.loadingLabel}><LoaderCircle size={16} aria-hidden="true" />{label}</span>
    {!compact && <div className={styles.skeletonGrid} aria-hidden="true">{[0, 1, 2].map(index => <div className={styles.skeletonCard} key={index}><span /><strong /><small /></div>)}</div>}
  </div>;
}
