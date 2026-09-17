"use client";
import { useState } from 'react';
import { loadCorporateData, saveCompany, addCorporateNote } from '@/lib/actions/corporate';
import type { CompanyInput, CorporateCompany } from '@/lib/types';
import styles from '../admin.module.css';
import { FeatureState, Field, useFeatureData } from './FeatureShared';
import CorporateBookingForm from './CorporateBookingForm';

const textFields = [ ['name','Company name'], ['industry','Industry'], ['website','Website'], ['location','Location'], ['contact_name','Contact name'], ['contact_email','Contact email'], ['contact_phone','Contact phone'], ['csr_focus_areas','CSR focus areas'], ['notes','Company notes'] ] as const;
export default function CorporateManager() {
  const { data, error, loading, reload } = useFeatureData(loadCorporateData);
  const [editing, setEditing] = useState<CorporateCompany | 'new' | null>(null);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(form: FormData) {
    setBusy(true); setMessage('');
    try {
      const fields = Object.fromEntries(textFields.map(([key]) => [key, String(form.get(key) ?? '').trim() || null]));
      const charitiesText = String(form.get('charities_supported') ?? '').trim();
      const charitiesCount = charitiesText === '' ? null : Number(charitiesText);
      if (charitiesCount !== null && (!Number.isInteger(charitiesCount) || charitiesCount < 0 || charitiesCount > 2147483647)) {
        throw new Error('Number of other charities supported must be a whole number from 0 to 2147483647, or left blank if unknown.');
      }
      const input = { ...fields, charities_supported: charitiesCount, name: String(form.get('name')).trim(), relationship_status: form.get('relationship_status'), partnership_potential: form.get('partnership_potential'), estimated_annual_csr: form.get('estimated_annual_csr') === '' ? null : Number(form.get('estimated_annual_csr')) } as CompanyInput;
      const saved = await saveCompany(editing && editing !== 'new' ? editing.id : null, input);
      setSelected(String(saved.id)); setEditing(null); await reload(); setMessage('Company saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save company.'); } finally { setBusy(false); }
  }
  async function addNote(form: FormData) {
    setBusy(true); setMessage('');
    try { await addCorporateNote(Number(selected), String(form.get('body'))); await reload(); setMessage('Note added.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to add note.'); } finally { setBusy(false); }
  }
  const company = data?.companies.find(c => String(c.id) === selected);
  const initial = editing && editing !== 'new' ? editing : null;
  return <div className={styles.featureStack}>
    <FeatureState error={error} loading={loading} retry={reload} />
    {message && <p role="status" className={styles.helper}>{message}</p>}
    {data && <>
      <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Corporate partnerships</h2><button className={styles.primaryButton} onClick={() => { setEditing('new'); setMessage(''); }}>Add company</button></div>
      <div className={styles.featureBody}><Field label="Search companies"><input className={styles.input} value={search} onChange={e => setSearch(e.target.value)} /></Field></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Company</th><th>Contact</th><th>Relationship</th><th>Potential</th><th>Actions</th></tr></thead><tbody>{data.companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => <tr key={c.id}><td>{c.name}</td><td>{c.contact_name || '—'}<br />{c.contact_email}</td><td><span className={`${styles.status} ${styles.statusConfirmed}`}>{c.relationship_status}</span></td><td>{c.partnership_potential}</td><td><button className={styles.secondaryButton} onClick={() => setSelected(String(c.id))}>View</button> <button className={styles.secondaryButton} onClick={() => setEditing(c)}>Edit</button></td></tr>)}</tbody></table></div>{!data.companies.length && <p className={styles.empty}>No companies yet. Add a company to begin.</p>}</section>
      {editing && <section className={styles.card} aria-labelledby="company-editor"><div className={styles.cardHeader}><h2 id="company-editor" className={styles.cardTitle}>{initial ? 'Edit company' : 'New company'}</h2></div><form key={initial?.id ?? 'new'} action={save} className={`${styles.featureBody} ${styles.formGrid}`}>
        {textFields.map(([key,label]) => <Field key={key} label={label}><input name={key} className={styles.input} defaultValue={initial?.[key] ?? ''} required={key === 'name'} type={key === 'contact_email' ? 'email' : key === 'website' ? 'url' : 'text'} /></Field>)}
        <Field label="Relationship"><select name="relationship_status" className={styles.select} defaultValue={initial?.relationship_status ?? 'Lead'}>{['Lead','Contacted','Interested','Active Partner','Inactive'].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Partnership potential"><select name="partnership_potential" className={styles.select} defaultValue={initial?.partnership_potential ?? 'Medium'}>{['Low','Medium','High'].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Number of other charities supported (if known)"><input name="charities_supported" className={styles.input} type="number" min="0" step="1" max="2147483647" defaultValue={initial?.charities_supported ?? ''} /></Field>
        <Field label="Estimated annual CSR (ZAR, manually entered)"><input name="estimated_annual_csr" className={styles.input} type="number" min="0" step="0.01" max="999999999999.99" defaultValue={initial?.estimated_annual_csr ?? ''} /></Field>
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className={styles.primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save company'}</button></div>
      </form></section>}
      <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Company activity</h2></div><div className={styles.featureBody}>
        <Field label="Company"><select className={styles.select} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a company</option>{data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        {company && <><p className={styles.helper}>{company.notes || 'No company notes recorded.'}</p><CorporateBookingForm key={company.id} company={company} data={data} reload={reload} />
          <h3 className={styles.cardTitle}>Relationship notes</h3>{data.notes.filter(n => n.company_id === company.id).map(n => <p key={n.id} className={styles.helper}><time>{new Date(n.created_at).toLocaleDateString('en-ZA')}</time> — {n.body}</p>)}
          <form action={addNote} className={styles.featureStack}><Field label="Add note"><textarea className={styles.textarea} name="body" required /></Field><button className={styles.secondaryButton} disabled={busy}>Add note</button></form>
        </>}
      </div></section>
    </>}
  </div>;
}
