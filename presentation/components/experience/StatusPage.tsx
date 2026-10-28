/** Consistent recovery screens show the next action without exposing internal exceptions. */
import Link from 'next/link';
import { ArrowLeft, HeartHandshake, RotateCcw, Sparkles } from 'lucide-react';
import styles from '@/presentation/components/experience/status-page.module.css';

export default function StatusPage({ title, message, reset, missing = false }: { title: string; message: string; reset?: () => void; missing?: boolean }) {
  return <section className={styles.card} role={missing ? undefined : 'alert'}>
    <div className={styles.art} aria-hidden="true"><span className={styles.ring} /><span className={styles.symbol}><HeartHandshake size={45} strokeWidth={1.3} /></span><Sparkles className={styles.sparkle} size={18} /></div>
    <span className={styles.eyebrow}>{missing ? '404 · A LITTLE OFF THE BEATEN PATH' : 'LET’S GET YOU BACK ON TRACK'}</span>
    <h1>{title}</h1><p>{message}</p>
    <div className={styles.actions}>{reset && <button type="button" className={styles.primary} onClick={reset}><RotateCcw size={15} />Try again</button>}<Link className={styles.secondary} href="/"><ArrowLeft size={15} />Back to sign in</Link></div>
  </section>;
}
