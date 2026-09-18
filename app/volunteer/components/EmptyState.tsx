import Link from "next/link";
import styles from "../volunteer.module.css";

export type EmptyStateIcon = "calendar" | "checklist";

type EmptyStateProps = {
  icon: EmptyStateIcon;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

function Icon({ icon }: { icon: EmptyStateIcon }) {
  const artwork = icon === "calendar"
    ? <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h3M13 14h3M8 17h3" /></>
    : <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M8 10l1.5 1.5L12 8.5M8 15l1.5 1.5L12 13.5M14 10h2M14 15h2" /></>;

  return <span className={styles.emptyStateIcon} aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{artwork}</svg></span>;
}

/** A reusable card-body state for areas that have no content yet. */
export default function EmptyState({ icon, title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return <div className={styles.emptyState}>
    <Icon icon={icon} />
    <h3 className={styles.emptyStateTitle}>{title}</h3>
    <p className={styles.emptyStateDescription}>{description}</p>
    <Link href={ctaHref} className={styles.primaryButton}>{ctaLabel}</Link>
  </div>;
}
