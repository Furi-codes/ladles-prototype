"use client";

// Preview-only directory: use the full profile list, not participants filtered to one event.
import {useState} from 'react';
import {useAdminData} from '../components/AdminProvider';
import {FeatureState} from '../components/FeatureShared';
import type {Volunteer} from '@/lib/types';
import styles from '../admin.module.css';
import ui from '../components/management.module.css';

export default function VolunteerDirectory(){
  const {volunteers,bookings,isLoading,loadError,fetchData}=useAdminData();
  const [query,setQuery]=useState('');
  const [contactFilter,setContactFilter]=useState('');
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Volunteer|null>(null);
  const matches=volunteers.filter(v=>v.role==='volunteer'&&`${v.full_name} ${v.email} ${v.phone||''}`.toLowerCase().includes(query.trim().toLowerCase())&&(!contactFilter||(contactFilter==='missing'?!v.phone:Boolean(v.phone))));
  const pages=Math.max(1,Math.ceil(matches.length/10));
  const current=Math.min(page,pages);
  const rows=matches.slice((current-1)*10,current*10);
  const contacts=(v:Volunteer)=><div className={styles.tableActions}>{v.email?<a className={styles.secondaryButton} href={'mailto:'+v.email}>Email volunteer</a>:null}{v.phone?<a className={styles.secondaryButton} href={'tel:'+v.phone.replace(/[^+0-9]/g,'')}>Call volunteer</a>:null}</div>;
  return <>
    <div className={styles.pageHeading}><div><h1 className={styles.pageTitle}>Volunteer directory</h1><p className={styles.pageDescription}>All registered volunteers, including people with no bookings. Search and view their contact details.</p></div></div>
    <FeatureState loading={isLoading} error={loadError||''} retry={()=>void fetchData()}/>
    {!isLoading&&!loadError&&<section className={styles.card}>
      <div className={ui.filters}><label>Search volunteers<input className={styles.input} type="search" placeholder="Name, email or cellphone" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>Cellphone<select className={styles.select} value={contactFilter} onChange={e=>{setContactFilter(e.target.value);setPage(1);}}><option value="">All volunteers</option><option value="provided">Number provided</option><option value="missing">Number missing</option></select></label><button className={styles.secondaryButton} onClick={()=>{setQuery('');setContactFilter('');setPage(1);}}>Clear filters</button></div>
      <p className={ui.count} role="status">{matches.length} volunteers · Page {current} of {pages}</p>
      <div className={ui.tableViewport}><table className={styles.table}><thead><tr><th>Volunteer</th><th>Email</th><th>Cellphone</th><th>Booking records</th><th>Contact / details</th></tr></thead><tbody>{rows.map(v=><tr key={v.id}><td>{v.full_name}</td><td>{v.email||'Not provided'}</td><td>{v.phone||<span className={styles.status}>Number needed</span>}</td><td>{bookings.filter(b=>b.user_id===v.id).length}</td><td>{contacts(v)}<button className={styles.secondaryButton} onClick={()=>setSelected(v)}>View details</button></td></tr>)}{!rows.length&&<tr><td colSpan={5}>No matching volunteers.</td></tr>}</tbody></table></div>
      <div className={styles.formActions} style={{padding:16}}><button className={styles.secondaryButton} disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button><button className={styles.secondaryButton} disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button></div>
      <p className={ui.count}>Preview uses fictional profiles. Email/call links open your device’s apps; this preview sends no message. Real profile access and cellphone storage still require database implementation.</p>
    </section>}
    {selected&&<div className={styles.dialogBackdrop}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="directory-person"><h2 id="directory-person" className={styles.dialogTitle}>{selected.full_name}</h2><dl><dt>Email</dt><dd>{selected.email||'Not provided'}</dd><dt>Cellphone</dt><dd>{selected.phone||'Not provided — profile update needed'}</dd><dt>Date of birth</dt><dd>{selected.date_of_birth||'Not provided'}</dd><dt>Booking records</dt><dd>{bookings.filter(b=>b.user_id===selected.id).length}</dd></dl>{contacts(selected)}<div className={styles.formActions}><button className={styles.secondaryButton} onClick={()=>setSelected(null)}>Close details</button></div></section></div>}
  </>;
}
