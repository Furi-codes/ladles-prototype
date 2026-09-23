"use client";
import { useEffect, useId, useState } from 'react';
import styles from '../admin.module.css';

export default function SearchSelector({ label, value, selectedLabel, loadOptions, query, onQuery, onChange }: {
  label: string; value: string; selectedLabel: string; query: string;
  loadOptions: (query: string) => Promise<{ value: string; label: string }[]>; onQuery: (value: string) => void; onChange: (value: string, label: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(label === 'Event');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(label === 'Event');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try { const result = await loadOptions(query); if (active) setOptions(result); }
      catch (e) { if (active) { setOptions([]); setError(e instanceof Error ? e.message : 'Search failed.'); } }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [loadOptions, query, open]);
  return <div className={styles.field}>
    <label className={styles.fieldLabel} htmlFor={id}>{label}</label>
    <input id={id} type="search" className={styles.input} value={query} placeholder={`Search ${label.toLowerCase()}`}
      onFocus={() => { if (!open) { setOpen(true); setLoading(true); } }} onChange={e => { onQuery(e.target.value); setOptions([]); setLoading(true); setOpen(true); }}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} aria-describedby={`${id}-selection`} aria-controls={`${id}-results`} />
    <div id={`${id}-selection`} className={styles.helper}>Selected: {selectedLabel || `All ${label.toLowerCase()}s`} {value && <button type="button" className={styles.secondaryButton} onClick={() => { onChange('', ''); onQuery(''); }}>Clear</button>}</div>
    {open && <div id={`${id}-results`} className={styles.featureStack}>
      <p className={styles.helper}>{query ? 'Up to 8 matches across all dates. Refine your search for more.' : label === 'Event' ? 'Recent events. Search to find older or upcoming events.' : 'Up to 8 locations. Type to narrow the results.'}</p>
      {loading && <p role="status" className={styles.helper}>Searching…</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!loading && options.map(option => <button type="button" className={styles.secondaryButton} key={option.value} aria-pressed={value === option.value} onClick={() => { onChange(option.value, option.label); onQuery(''); setOpen(false); }}>{option.label}</button>)}
      {!loading && !error && !options.length && <p role="status" className={styles.helper}>No matches.</p>}
      <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>Close results</button>
    </div>}
  </div>;
}
