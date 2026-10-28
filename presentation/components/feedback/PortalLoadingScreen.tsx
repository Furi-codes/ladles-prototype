/**
 * Combines the shared animation and loading message for a portal.
 * Portal wrappers supply their own wording while this component keeps the presentation
 * consistent.
 */

import SoupLoader from "@/presentation/components/feedback/SoupLoader";
import styles from "@/presentation/components/feedback/PortalLoadingScreen.module.css";
import { HeartHandshake } from 'lucide-react';

export default function PortalLoadingScreen({ message = "Ladles of Love is preparing your portal…" }: { message?: string }) {
  return <main className={styles.screen}><div className={styles.loadingBrand}><HeartHandshake size={19} aria-hidden="true" />LADLES OF LOVE</div><div className={styles.content}><div className={styles.loaderStage}><span className={styles.loaderRing} aria-hidden="true" /><span className={styles.loaderRingInner} aria-hidden="true" /><SoupLoader size={175} label={message} /></div><h1 className={styles.title}>A little stir while you wait.</h1><p className={styles.message}>{message}</p><div className={styles.loadingDots} aria-hidden="true"><span /><span /><span /></div></div></main>;
}
