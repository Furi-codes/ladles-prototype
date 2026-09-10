import styles from "../admin.module.css";

export default function ComingSoon({ title }: { title: string }) {
  return <section className={`${styles.card} ${styles.placeholder}`}><h2 className={styles.placeholderTitle}>{title}</h2><p className={styles.placeholderText}>This administration section is reserved for a future update. The dashboard, events, and volunteer workflows remain available.</p></section>;
}
