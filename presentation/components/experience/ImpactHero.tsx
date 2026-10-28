"use client";

/** A compact workspace introduction keeps the heading and its main action together. */
import { ArrowUpRight, CalendarDays, HeartHandshake, LayoutDashboard, UsersRound } from 'lucide-react';
import Link from 'next/link';
import styles from '@/presentation/components/experience/experience.module.css';

type HeroProps = { eyebrow: string; title: string; accent: string; description: string; href?: string; action?: string; variant?: 'admin' | 'volunteer' | 'corporate'; children?: React.ReactNode };

export default function ImpactHero({ eyebrow, title, accent, description, href, action, variant = 'admin', children }: HeroProps) {
  const Symbol = variant === 'admin' ? LayoutDashboard : variant === 'corporate' ? UsersRound : HeartHandshake;
  return <section className={styles.hero} data-reveal data-variant={variant}>
    <div className={styles.heroCopy}>
      <span className={styles.eyebrow}><Symbol size={15} aria-hidden="true" />{eyebrow}</span>
      <h1 data-hero-title>{title}</h1>
      <p className={styles.heroAccent}>{accent}</p>
      <p>{description}</p>
    </div>
    {(href || children) && <div className={styles.heroActions}>
      {href && <Link href={href} className={styles.heroButton}><span className={styles.actionIcon}><CalendarDays size={20} aria-hidden="true" /></span><span>{action}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>}
      {children}
    </div>}
  </section>;
}
