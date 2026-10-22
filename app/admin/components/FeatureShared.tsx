"use client";
/** Shared loader hook and small form/loading wrappers for admin feature screens. */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../admin.module.css';
/** Runs a caller's async loader, exposing its data, retry action and loading/error state. */
export function useFeatureData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const request = useRef(0);
  /** Applies only the latest reload result, clearing failed data rather than displaying stale feature rows. */
  const reload = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setError('');
    try { const result = await loader(); if (version === request.current) setData(result); } catch (e) { if (version === request.current) { setError(e instanceof Error ? e.message : 'Unable to load data.'); setData(null); } }
    finally { if (version === request.current) setLoading(false); }
  }, [loader]);
  const invalidate = useCallback(() => { ++request.current; }, []);
  // Cleanup also makes an in-flight response stale, so a replaced screen cannot restore old records.
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; invalidate(); }; }, [reload, invalidate]);
  return { data, error, loading, reload };
}
/** Shows loading first, then an error with Retry; returns nothing for a successful loaded state. */
export function FeatureState({ error, loading, retry }: { error: string; loading: boolean; retry: () => void }) {
  if (loading) return <p className={styles.helper} role="status">Loading...</p>;
  if (error) return <div className={styles.error} role="alert">{error} <button className={styles.secondaryButton} onClick={retry}>Retry</button></div>;
  return null;
}
/** Wraps a form control in its visible label with the shared admin field styles. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}</span>{children}</label>;
}

