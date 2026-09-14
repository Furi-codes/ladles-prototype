import SoupLoader from "./SoupLoader";
import styles from "./PortalLoadingScreen.module.css";

export default function PortalLoadingScreen({ message = "Ladles of Love is preparing your portal…" }: { message?: string }) {
  return <main className={styles.screen}><div className={styles.content}><SoupLoader label={message} /><h1 className={styles.title}>A little stir while you wait.</h1><p className={styles.message}>{message}</p></div></main>;
}
