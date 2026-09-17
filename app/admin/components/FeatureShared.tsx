"use client";
import { useCallback, useEffect, useState } from 'react';
import styles from '../admin.module.css';
export function useFeatureData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await loader()); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load data.'); setData(null); }
    finally { setLoading(false); }
  }, [loader]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);
  return { data, error, loading, reload };
}
export function FeatureState({ error, loading, retry }: { error: string; loading: boolean; retry: () => void }) {
  if (loading) return <p className={styles.helper} role="status">Loading...</p>;
  if (error) return <div className={styles.error} role="alert">{error} <button className={styles.secondaryButton} onClick={retry}>Retry</button></div>;
  return null;
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}</span>{children}</label>;
}

