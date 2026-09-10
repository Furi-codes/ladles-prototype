import styles from "../volunteer.module.css";

export default function VolunteerLoadingScreen({ message = "Loading volunteer portal..." }: { message?: string }) {
  return <main className={styles.loadingScreen}><div className={styles.loadingSpinner} aria-hidden="true" /><p className={styles.loadingMessage}>{message}</p></main>;
}
