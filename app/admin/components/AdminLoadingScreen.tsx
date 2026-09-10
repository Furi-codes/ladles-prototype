import styles from "../admin.module.css";

export default function AdminLoadingScreen({ message = "Loading administration..." }: { message?: string }) {
  return <main className={styles.loadingScreen}><div className={styles.loadingSpinner} aria-hidden="true" /><p className={styles.loadingMessage}>{message}</p></main>;
}
