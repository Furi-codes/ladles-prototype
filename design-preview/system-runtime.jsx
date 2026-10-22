/* Local fixtures/adapters only. No Supabase SDK, credentials or production APIs are used. */
import React,{useEffect,useState,useSyncExternalStore} from 'react';
import styles from './system-source/app/admin/admin.module.css';
let version=0,path='/',viewState='normal',signedRole='volunteer',avatar=null;
const listeners=new Set();
const emit=()=>{version++;listeners.forEach(fn=>fn());};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const tick=()=>version;
const clone=value=>JSON.parse(JSON.stringify(value));
const date=offset=>new Date(Date.now()+offset*86400000).toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'});
const iso=(day,time)=>new Date(day+'T'+time+':00+02:00').toISOString();
const categories=['Dignity Kitchen','Warehouse HQ','Feed The Soil','Campaign / Special Event'];
const initial=()=>{
  const events=[-85,-58,-29,-7,0,1,4,12,21].map((offset,index)=>({id:index+1,title:['Community kitchen morning','Warehouse packing shift','Feed The Soil session','Community meal preparation'][index%4],date:date(offset),location:index%2?'Example Warehouse, Cape Town':'Example Community Kitchen',time_slots:'09:15-11:15',total_slots:30,description:'Fictional event for reviewing the current portal UI. Bring comfortable closed shoes.',status:'Scheduled',category:categories[index%4],location_url:null,external_event_id:index===6?'demo-wms-event':null}));
  const eventSlots=events.map(event=>({id:event.id*10,event_id:event.id,start_time:'09:15',end_time:'11:15',capacity:30,remaining:30,external_timeslot_id:event.external_event_id?'demo-wms-slot':null}));
  const volunteers=[{id:'demo-volunteer',full_name:'Alex Example',email:'volunteer@example.invalid',role:'volunteer',date_of_birth:'1998-04-12',phone:'+27 00 000 0001',avatar_path:null},{id:'demo-other',full_name:'Jordan Sample',email:'jordan@example.invalid',role:'volunteer',date_of_birth:'1995-07-08',phone:'+27 00 000 0002'}];
  // Include a registered person with no bookings and no phone to demonstrate the directory's full scope.
  volunteers.push({id:'demo-unbooked',full_name:'Taylor Example',email:'taylor@example.invalid',role:'volunteer',date_of_birth:'2000-01-21',phone:''});
  const bookings=[1,2,4,5,6].map((eventId,index)=>({id:100+index,event_id:eventId,event_slot_id:eventId*10,user_id:'demo-volunteer',volunteer_name:'Alex Example',volunteer_email:'volunteer@example.invalid',selected_slot:'09:15-11:15',status:index<3?'Completed':'Confirmed'}));
  bookings.push({id:110,event_id:6,event_slot_id:60,user_id:'demo-other',volunteer_name:'Jordan Sample',volunteer_email:'jordan@example.invalid',selected_slot:'09:15-11:15',status:'Confirmed'});
  const attendance=bookings.filter(b=>b.status==='Completed').map(b=>({booking_id:b.id,clocked_in_at:iso(events.find(e=>e.id===b.event_id).date,'09:15'),clocked_out_at:iso(events.find(e=>e.id===b.event_id).date,'11:15'),worked_minutes:120}));
  const companies=[{id:1,name:'Example Business',industry:'Retail',website:'',location:'Cape Town',contact_name:'Sam Example',contact_email:'sam@example.invalid',contact_phone:'+27 00 000 0003',relationship_status:'Active Partner',charities_supported:2,estimated_annual_csr:10000,csr_focus_areas:'Food security',partnership_potential:'High',notes:'Fictional legacy CSR record. Proposed corporate self-service is a separate preview.',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
  const corporate=[{id:1,company_id:1,event_id:1,event_slot_id:10,contact_name:'Sam Example',contact_email:'sam@example.invalid',team_size:5,status:'Completed',notes:'Sample legacy CSR booking',attendance_count:4,volunteer_hours:8,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
  return {events,eventSlots,bookings,attendance,volunteers,companies,corporate,notes:[],audit:[],reminders:true,settings:{id:1,organisation_name:'Ladles of Love',default_location:'',contact_email:'',timezone:'Africa/Johannesburg',booking_confirmation_enabled:false,booking_cancellation_enabled:false,shift_reminder_enabled:true,corporate_booking_confirmation_enabled:false,updated_at:new Date().toISOString()},notifications:[{id:1,user_id:'demo-volunteer',event_id:6,type:'shift_reminder_24h',title:'Your upcoming shift',message:'Fictional reminder: review your booking details.',is_read:false,created_at:new Date().toISOString()}]};
};
export let data=initial();
function availability(){return data.eventSlots.map(slot=>({...slot,remaining:Math.max(0,slot.capacity-data.bookings.filter(b=>b.event_slot_id===slot.id).length-data.corporate.filter(b=>b.event_slot_id===slot.id&&b.status!=='Cancelled').reduce((n,b)=>n+b.team_size,0))}));}
export const routes=['/','/update-password','/admin','/admin/events','/admin/volunteers','/admin/directory','/admin/csr','/admin/reports','/admin/settings','/volunteer','/volunteer/impact','/volunteer/attendance','/volunteer/profile','/volunteer/notifications','/proposal','/proposal/business','/proposal/admin'];
export function go(next){path=routes.includes(next.split('?')[0])?next:'/';if(path.startsWith('/admin'))signedRole='admin';if(path.startsWith('/volunteer'))signedRole='volunteer';if(typeof window!=='undefined'){window.history.replaceState(null,'','#'+path);window.scrollTo?.(0,0);}emit();}
export function usePathname(){useSyncExternalStore(subscribe,tick,tick);return path.split('?')[0];}
const router={push:go,replace:go,refresh:emit,back:()=>go(signedRole==='admin'?'/admin':'/volunteer'),prefetch:()=>{}};
export const useRouter=()=>router;
export function useSearchParams(){useSyncExternalStore(subscribe,tick,tick);return new URLSearchParams(path.split('?')[1]||'');}
export function setPreviewState(value){viewState=value;emit();}
export function resetPreview(){data=initial();viewState='normal';avatar=null;emit();}
export function currentUser(){return {id:signedRole==='admin'?'demo-admin':'demo-volunteer',email:signedRole==='admin'?'admin@example.invalid':'volunteer@example.invalid',user_metadata:{full_name:'Alex Example'}};}
function identity(){return signedRole==='admin'?{id:'demo-admin',full_name:'Demo Administrator',email:'admin@example.invalid',role:'admin'}:data.volunteers[0];}
export function PreviewProvider({children}){return children;}
export function useAdminData(){useSyncExternalStore(subscribe,tick,tick);const empty=viewState==='empty';return {events:empty?[]:data.events,bookings:empty?[]:data.bookings,eventSlots:empty?[]:availability(),volunteers:empty?[]:data.volunteers,attendanceRecords:empty?[]:data.attendance,attendanceCheckpoints:data.events.flatMap(e=>['clock_in','clock_out'].map(action=>({id:'demo-'+e.id+'-'+action,entry_code:action==='clock_in'?'DEMO-IN':'DEMO-OUT',event_id:e.id,action,is_active:true}))),adminProfile:{full_name:'Demo Administrator',email:'admin@example.invalid'},isLoading:viewState==='loading',isCheckingAccess:false,loadError:viewState==='error'?'Simulated loading error. Switch the preview state back to Normal.':null,fetchData:async()=>emit()};}
export function useVolunteerData(){const admin=useAdminData();return {...admin,user:{id:'demo-volunteer'},profile:data.volunteers[0],avatarUrl:avatar,consent:{user_id:'demo-volunteer',code_of_conduct_accepted:true,data_use_accepted:true,information_accuracy_accepted:true,consent_version:'2026-09-14',accepted_at:new Date().toISOString()},notifications:data.notifications,notificationsLoading:false,notificationError:null,refreshNotifications:async()=>emit(),markAllNotificationsRead:async()=>{data.notifications.forEach(n=>n.is_read=true);emit();},remindersEnabled:data.reminders,reminderPreferenceError:null,loadReminderPreference:async()=>{},saveReminderPreference:async value=>{data.reminders=value;emit();return null;},refreshData:async()=>emit(),createUserBooking:async slot=>{const result=await action('bookEventSlot',slot.id);return result.error?.message||null;},cancelBooking:async id=>{await action('cancelUserBooking',id,'demo-volunteer');},dismissNotification:async id=>{data.notifications.find(n=>n.id===id).is_read=true;emit();},saveProfile:async input=>{Object.assign(data.volunteers[0],input);emit();return null;},saveAvatar:async photo=>{if(avatar)URL.revokeObjectURL(avatar);avatar=photo?URL.createObjectURL(photo):null;emit();return null;},requestEmailChange:async()=>null,acceptConsent:async()=>null,showToast:()=>{},toasts:[]};}
function featureData(name){if(name.includes('loadSettings'))return {settings:data.settings,admins:[{id:'demo-admin',full_name:'Demo Administrator',email:'admin@example.invalid',role:'admin'}]};if(name.includes('loadCorporateData'))return {companies:data.companies,bookings:data.corporate,notes:data.notes,events:data.events,slots:availability()};return {events:data.events,slots:availability(),bookings:data.bookings,attendance:data.attendance,corporate:data.corporate,companies:data.companies};}
export function useFeatureData(loader){const revision=useSyncExternalStore(subscribe,tick,tick);const hint=loader.previewName||loader.name+' '+loader.toString();const [result,setResult]=useState(()=>featureData(hint));const [error,setError]=useState('');useEffect(()=>{let active=true;Promise.resolve(loader()).then(value=>{if(active)setResult(value);},reason=>{if(active)setError(reason.message);});return()=>{active=false;};},[loader,revision]);return {data:viewState==='empty'?{...result,events:[],bookings:[],corporate:[],companies:[],notes:[],slots:[]}:result,loading:viewState==='loading',error:viewState==='error'?'Simulated feature error.':error,reload:async()=>{setResult(await loader());emit();}};}
export function Field({label,children}){return <label className={styles.field}><span className={styles.fieldLabel}>{label}</span>{children}</label>;}
export function FeatureState({error,loading,retry}){return loading?<p role="status">Loading…</p>:error?<div role="alert" className={styles.error}>{error} <button onClick={retry}>Retry</button></div>:null;}
export function DemoScanner({onScan}){return <section className={styles.card}><div className={styles.featureBody}><h2>Camera preview</h2><p>No camera permission or real QR scan is used in this UI copy.</p><button className={styles.primaryButton} onClick={()=>onScan('demo-5-clock_in')}>Simulate clock-in scan</button><button className={styles.secondaryButton} onClick={()=>onScan('demo-5-clock_out')}>Simulate clock-out scan</button></div></section>;}
const ok=value=>({data:value,error:null});
function audit(action,entityId,details={}){data.audit.unshift({id:Date.now(),actor_name:'Demo user',actor_email:identity().email,action,entity_type:'PREVIEW',entity_id:String(entityId||''),entity_label:'Local demo record',details,created_at:new Date().toISOString(),source:'VMS'});}
export async function action(name,...args){
  const [id,input,ranges]=args;
  if(name==='loadReportData'||name==='loadCorporateData'||name==='loadSettings')return clone(featureData(name));
  if(name==='fetchCommunityParticipation')return ok(Array.from({length:6},(_,i)=>({month_start:date(-150+i*30).slice(0,7)+'-01',volunteer_count:[3,5,4,7,6,8][i]})));
  if(name==='searchReportEvents')return data.events.filter(e=>e.title.toLowerCase().includes(String(id).toLowerCase())).map(e=>({value:String(e.id),label:e.title+' · '+e.date}));
  if(name==='searchReportLocations')return [...new Set(data.events.map(e=>e.location))].filter(l=>l.toLowerCase().includes(String(id).toLowerCase())).map(l=>({value:l,label:l}));
  if(name==='fetchSlotAvailability')return availability().map(s=>({event_slot_id:s.id,remaining:s.remaining}));
  if(name==='loadAdminAuditLog')return clone(data.audit);
  if(name==='logAdminAction'){audit(id.action,id.entityId,id.details);emit();return;}
  if(name==='currentAccessUserId')return 'demo-admin';
  if(name==='searchAccessProfiles')return [{id:'demo-admin',full_name:'Demo Administrator',email:'admin@example.invalid',role:'admin'},...data.volunteers].filter(p=>(p.full_name+' '+p.email).toLowerCase().includes(String(id).toLowerCase()));
  if(name==='changeAdminAccess'){audit('DEMO_ACCESS_CHANGED',id,{role:input});emit();return;}
  if(name==='saveEventWithSlots'){
    const eventId=id||Math.max(...data.events.map(e=>e.id),0)+1;
    const event={...(data.events.find(e=>e.id===eventId)||{}),id:eventId,...input,status:'Scheduled',time_slots:ranges.map(s=>s.start_time+'-'+s.end_time).join(', '),total_slots:ranges.reduce((n,s)=>n+s.capacity,0)};
    data.events=data.events.filter(e=>e.id!==eventId).concat(event);data.eventSlots=data.eventSlots.filter(s=>s.event_id!==eventId).concat(ranges.map((s,i)=>({...s,id:s.id||eventId*10+i,event_id:eventId})));emit();return ok(event);
  }
  if(name==='updateEventMetadata'){Object.assign(data.events.find(e=>e.id===id),input);emit();return ok(null);}
  if(name==='deleteEvent'){if(data.bookings.some(b=>b.event_id===id))return {data:null,error:{message:'Demo event has bookings; cancel it instead.'}};data.events=data.events.filter(e=>e.id!==id);data.eventSlots=data.eventSlots.filter(s=>s.event_id!==id);emit();return ok(null);}
  if(name==='cancelEvent'){Object.assign(data.events.find(e=>e.id===id),{status:'Cancelled',cancellation_message:input});emit();return ok({id});}
  if(name==='bookEventSlot'){
    const slot=availability().find(s=>s.id===id);
    if(!slot||slot.remaining<1)return {data:null,error:{message:'This demo slot is full.'}};
    if(data.bookings.some(b=>b.event_id===slot.event_id&&b.user_id==='demo-volunteer'))return {data:null,error:{message:'You already have a booking for this event.'}};
    const row={id:Math.max(...data.bookings.map(b=>b.id),0)+1,event_id:slot.event_id,event_slot_id:id,user_id:'demo-volunteer',volunteer_name:data.volunteers[0].full_name,volunteer_email:data.volunteers[0].email,status:'Confirmed',selected_slot:slot.start_time.slice(0,5)+'-'+slot.end_time.slice(0,5)};data.bookings.push(row);emit();return ok(row);
  }
  if(name==='deleteBooking'||name==='cancelUserBooking'){data.bookings=data.bookings.filter(b=>b.id!==id);data.attendance=data.attendance.filter(a=>a.booking_id!==id);emit();return ok(null);}
  if(name==='updateBookingAttendance'){data.bookings.find(b=>b.id===id).status=input;emit();return ok(null);}
  if(name==='recordEventAttendance'||name==='recordEventAttendanceCode'){
    const booking=data.bookings.find(b=>b.user_id==='demo-volunteer'&&b.event_id===5);if(!booking)return {data:null,error:{message:'Book today’s demo shift first.'}};
    let record=data.attendance.find(a=>a.booking_id===booking.id);if(!record){record={booking_id:booking.id,clocked_in_at:new Date().toISOString(),clocked_out_at:null,worked_minutes:null};data.attendance.push(record);booking.status='Present';}
    if(String(id).toLowerCase().includes('out')){record.clocked_out_at=new Date().toISOString();record.worked_minutes=1;booking.status='Completed';}emit();return ok(record);
  }
  if(name==='rotateAttendanceEntryCode')return ok({entry_code:'DEMO-NEW',id});
  if(['saveCompany','addCorporateNote','saveCorporateBooking'].includes(name))throw new Error('Legacy CSR is read-only in this preview. Use Corporate bookings for the proposed independent workflow.');
  if(name==='saveNotificationSettings'||name==='saveSettings'){Object.assign(data.settings,id,{updated_at:new Date().toISOString()});emit();return;}
  if(name==='saveAdminName'){audit('DEMO_NAME_UPDATED','demo-admin',{full_name:id});emit();return;}
  if(name==='fetchVolunteerReminderPreference')return ok({reminders_enabled:data.reminders});
  if(name==='saveVolunteerReminderPreference'){data.reminders=id;emit();return ok(null);}
  if(name==='fetchVolunteerNotifications')return ok(data.notifications);
  if(name==='fetchVolunteerAttendanceRecords'||name==='fetchAdminAttendanceRecords')return ok(data.attendance);
  if(name==='fetchBookingsForVolunteer'||name==='fetchAdminBookings')return ok(data.bookings);
  if(name==='fetchEventsForVolunteer'||name==='fetchAdminEvents')return ok(data.events);
  if(name==='fetchEventSlotsForVolunteer'||name==='fetchAdminEventSlots')return ok(availability());
  if(name==='fetchUserRole'||name==='ensureUserProfile')return ok(identity());
  // Unknown writes must fail visibly instead of pretending the full backend exists.
  throw new Error('This operation is not simulated in the UI preview: '+name);
}
export const supabase={auth:{
  getSession:async()=>({data:{session:path==='/'?null:{user:currentUser()}}}),getUser:async()=>({data:{user:currentUser()},error:null}),
  signInWithPassword:async({email})=>{signedRole=email.toLowerCase().includes('admin')?'admin':'volunteer';return {data:{user:currentUser()},error:null};},
  // The copied login has a Google button. Show a useful offline response instead of calling OAuth or throwing.
  signInWithOAuth:async()=>({data:null,error:{message:'Google sign-in is not connected in this offline preview. Use the demo login or toolbar.'}}),
  signOut:async()=>ok(null),signUp:async()=>({data:{user:null},error:null}),resetPasswordForEmail:async()=>ok(null),updateUser:async()=>ok({user:currentUser()}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
},from:table=>{const q={select(){return q;},eq(){return q;},single:async()=>ok(table==='profiles'?identity():null),maybeSingle:async()=>ok(identity())};return q;},storage:{from:()=>({createSignedUrl:async()=>ok({signedUrl:null})})}};
export function installOfflineBoundary(){
  window.fetch=async()=>new Response(JSON.stringify({results:[],error:'External services are disabled in this offline preview.'}),{status:503,headers:{'content-type':'application/json'}});
  window.XMLHttpRequest=class {open(){throw new Error('Network requests disabled in preview.');}};
  window.WebSocket=class {constructor(){throw new Error('Realtime connections disabled in preview.');}};
}
export function currentRoute(){return path;}
