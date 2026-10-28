"use client";

/** Each selection appears in place; the marker never slides across neighbouring links. */
import styles from '@/presentation/components/experience/experience.module.css';

export default function ActivePill({ group }: { group: string }) {
  return <span aria-hidden="true" data-navigation-group={group} className={styles.activePill} />;
}
