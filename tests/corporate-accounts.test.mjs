import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const details={company_name:'Example Co',contact_name:'Contact',contact_email:'contact@example.invalid',contact_phone:' +27 21 555 1234 ',billing_address:'Fictional address'};
function modules({enabled=true,bookings=false,changes=false,outcomes=false,hooks=null,rpc=async()=>({data:{ok:true},error:null}),from=()=>{throw new Error('Unexpected table query');}}={}){
  const cache=new Map();
  const supabase={rpc,from,auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})}};
  function load(path){
    const full=resolve(root,path);if(cache.has(full))return cache.get(full).exports;
    const compiledModule={exports:{}};cache.set(full,compiledModule);
    const compiled=ts.transpileModule(readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const dependency=name=>{
      if(name==='@/lib/supabase')return {supabase};
      if(name==='@/lib/feature-flags')return {corporateRolloutEnabled:enabled,corporateBookingsEnabled:enabled&&bookings,corporateChangesEnabled:enabled&&bookings&&changes,corporateOutcomesEnabled:enabled&&bookings&&changes&&outcomes};
      if(name==='react'&&hooks)return {...React,...hooks};
      if(name==='next/navigation')return {useRouter:()=>({push(){},replace(){}}),usePathname:()=>'/admin'};
      if(name==='next/image')return {__esModule:true,default:({src,alt,width,height})=>React.createElement('img',{src,alt,width,height})};
      if(name==='next/link')return {__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)};
      if(name==='@/app/components/ThemeToggle'||name==='./ThemeToggle')return {__esModule:true,default:()=>React.createElement('button',{},'Theme')};
      if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
      if(name.startsWith('@/')||name.startsWith('.')){
        const base=name.startsWith('@/')?resolve(root,name.slice(2)):resolve(dirname(full),name);
        for(const suffix of ['', '.ts','.tsx'])if(existsSync(base+suffix))return load(base+suffix);
      }
      return require(name);
    };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`,{filename:full})(dependency,compiledModule,compiledModule.exports);return compiledModule.exports;
  }
  return {load};
}

test('phone validation accepts readable real formats, rejects punctuation-only, letters and excessive digits',()=>{
  const {isValidPhone,normalisePhone}=modules().load('lib/contact-details.ts');
  assert.equal(normalisePhone('  +27   21 555 1234  '),'+27 21 555 1234');
  for(const phone of ['+27 21 555 1234','0215551234','(bad)', '.......','+1234567890123456','12+3456789',''])assert.equal(isValidPhone(phone),['+27 21 555 1234','0215551234'].includes(phone),phone);
});

test('corporate event dates use South African time and overdue never means automatic cancellation',()=>{
  const utils=modules().load('lib/corporate-booking-utils.ts');
  assert.equal(utils.corporateTimestamp('2099-11-15T09:15'),'2099-11-15T09:15:00+02:00');
  assert.equal(utils.corporateLocalInput('2099-11-15T07:15:00Z'),'2099-11-15T09:15');
  for(const invalid of ['2099-02-30T09:15','2099-11-15T25:00','2099-11-15 09:15',''])assert.throws(()=>utils.corporateTimestamp(invalid));
  const due='2099-11-14T10:00:00Z';
  assert.equal(utils.corporateBookingOverdue({status:'Pending payment',payment_due_at:due},Date.parse(due)),true);
  assert.equal(utils.corporateBookingOverdue({status:'Confirmed',payment_due_at:due},Date.parse(due)),false);
  assert.equal(utils.corporateBookingOverdue({status:'Pending payment',payment_due_at:null}),false);
  assert.throws(()=>utils.validateCorporateEvent({starts_at:'2099-11-15T23:00:00+02:00',ends_at:'2099-11-16T01:00:00+02:00',capacity:10,min_group_size:1,max_group_size:10}),/same-day/);
});

test('booking rollout is separately gated and errors never count as successful decisions',async()=>{
  let calls=0;
  const disabled=modules({rpc:async()=>{calls++;throw new Error('must not run');}}).load('lib/actions/corporate-bookings.ts');
  await assert.rejects(disabled.getCorporateBookingSettings(),/not enabled/);assert.equal(calls,0);
  for(const [error,expected] of [[{code:'40001',message:'stale'},/changed while/],[{code:'PGRST202',message:'missing'},/temporarily unavailable/]]){
    const actions=modules({bookings:true,rpc:async()=>({data:null,error})}).load('lib/actions/corporate-bookings.ts');
    await assert.rejects(actions.getCorporateBookingSettings(),expected);
  }
  const empty=modules({bookings:true,rpc:async()=>({data:null,error:null})}).load('lib/actions/corporate-bookings.ts');
  await assert.rejects(empty.getCorporateBookingSettings(),/no result/);
  const incompatible=modules({bookings:true,rpc:async()=>({data:{booking_schema_version:2},error:null})}).load('lib/actions/corporate-bookings.ts');
  await assert.rejects(incompatible.getCorporateBookingSettings(),/temporarily unavailable/);
});

test('booking services send version/retry keys, bounded pages and only editable event fields',async()=>{
  const requests=[];
  const actions=modules({bookings:true,rpc:async(name,args)=>{requests.push({name,args});return {data:{id:'saved'},error:null};}}).load('lib/actions/corporate-bookings.ts');
  await actions.requestCorporateBooking({id:'event',version:4},7,' Note ','retry-key');
  assert.deepEqual(requests[0],{name:'corporate_request_booking',args:{p_event_id:'event',p_event_version:4,p_group_size:7,p_notes:'Note',p_request_key:'retry-key'}});
  await actions.setCorporatePaymentDeadline({id:'booking',version:3},'2099-11-14T17:00:00+02:00',' Discussed externally ');
  assert.equal(requests[1].args.p_version,3);
  await actions.recordCorporatePayment({id:'booking',version:3},'payment-key',' REF ','2026-10-21','Verified');
  assert.equal(requests[2].args.p_request_key,'payment-key');assert.equal(requests[2].args.p_reference,'REF');
  await actions.searchCorporateBookings({query:' Company ',status:'Overdue',from:'2099-11-01',to:'2099-11-30'},2);
  assert.deepEqual(requests[3].args,{p_query:'Company',p_status:'Overdue',p_from:'2099-11-01',p_to:'2099-11-30',p_offset:10,p_limit:10});
  const input={title:' Event ',description:' Description ',location:' Venue ',starts_at:'2099-11-15T09:15:00+02:00',ends_at:'2099-11-15T10:15:00+02:00',capacity:10,min_group_size:1,max_group_size:10,is_published:true};
  await actions.saveCorporateEvent({...input,reserved_places:0,created_by:'another',status:'Confirmed'},' Publish ','create-key');
  assert.deepEqual(requests[4].args.p_details,{...input,title:'Event',description:'Description',location:'Venue'});
  assert.equal(requests[4].args.p_creation_key,'create-key');
  await assert.rejects(actions.searchCorporateEvents(undefined,0),/valid page/);
  await assert.rejects(actions.configureCorporateBookings(true,'',''),/approved booking/);
  await assert.rejects(actions.requestCorporateBooking({id:'event',version:4},1.5,'','key'),/whole-number/);
  assert.equal(requests.length,5);
});

test('approved corporate login routes to bookings only when the separate booking rollout is enabled',async()=>{
  const from=status=>()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'company',status},error:null})});
  for(const [status,expected] of [['Approved','/corporate/bookings'],['Awaiting approval','/corporate'],['Rejected','/corporate']]){
    const routing=modules({bookings:true,from:from(status)}).load('lib/actions/account-routing.ts');
    assert.equal(await routing.accountLandingPath('volunteer'),expected);
    assert.equal(await routing.accountLandingPath('admin'),'/admin');
  }
  assert.equal(await modules({from:from('Approved')}).load('lib/actions/account-routing.ts').accountLandingPath('volunteer'),'/corporate');
});

test('real corporate forms show group/contact review, external payment and admin-only decision controls',()=>{
  const m=modules({bookings:true});
  const event={id:'event',version:1,title:'Corporate session',description:'Admin-authored description',location:'Example venue',starts_at:'2099-11-15T09:15:00+02:00',ends_at:'2099-11-15T10:15:00+02:00',capacity:10,min_group_size:2,max_group_size:8,reserved_places:0,remaining:10,state:'Available'};
  const forms=m.load('app/corporate/components/CorporateEventBrowser.tsx');
  const markup=renderToStaticMarkup(React.createElement(forms.CorporateRequestForm,{event,account:details,committed(){},dirtyChanged(){}}));
  for(const text of ['Group size','Billing address','not rewrite','No payment is processed','Review &amp; submit request'])assert.ok(markup.includes(text),text);
  const eventMarkup=renderToStaticMarkup(React.createElement(forms.CorporateEventForm,{committed(){},dirtyChanged(){}}));
  assert.match(eventMarkup,/step="900"/);assert.match(eventMarkup,/Minimum per booking/);assert.match(eventMarkup,/Publish for corporate requests/);
  const {CorporateBookingPanel}=m.load('app/corporate/components/CorporateBookingList.tsx');
  const props={detail:{booking:{id:'booking',account_id:'account',status:'Pending payment',version:2,event,group_size:3,contact_snapshot:details,notes:'',payment_due_at:'2099-11-14T10:00:00+02:00'},payments:[],history:[]},settings:{booking_enabled:true},dirtyChanged(){},refresh(){},committed:async()=>{}};
  const admin=renderToStaticMarkup(React.createElement(CorporateBookingPanel,{...props,admin:true}));
  const owner=renderToStaticMarkup(React.createElement(CorporateBookingPanel,{...props,admin:false}));
  assert.match(admin,/Record external payment &amp; confirm/);assert.match(admin,/Wait \/ extend deadline/);assert.match(admin,/Reject booking/);
  assert.doesNotMatch(owner,/Record external payment &amp; confirm|Reject booking/);assert.match(owner,/Online change requests are not enabled/);
  const sidebar=renderToStaticMarkup(React.createElement(m.load('app/admin/components/Sidebar.tsx').default));
  assert.match(sidebar,/Corporate bookings/);assert.match(sidebar,/Legacy CSR history/);
});

test('disabled rollout makes no database request and preserves existing login destinations',async()=>{
  let calls=0;const m=modules({enabled:false,rpc:async()=>{calls++;throw new Error('must not run');}});
  const actions=m.load('lib/actions/corporate-accounts.ts');
  await assert.rejects(actions.registerCorporateAccount(details),/not enabled/);
  const routing=m.load('lib/actions/account-routing.ts');assert.equal(await routing.accountLandingPath('volunteer',true),'/volunteer');assert.equal(await routing.accountLandingPath('admin'),'/admin');assert.equal(calls,0);
});

test('account RPCs send only clean editable fields; failures or missing results never count as success',async()=>{
  const requests=[];const m=modules({rpc:async(name,args)=>{requests.push({name,args});return {data:{id:'account'},error:null};}});
  const actions=m.load('lib/actions/corporate-accounts.ts');
  await actions.registerCorporateAccount({...details,status:'Approved',owner_user_id:'another-user',role:true});
  assert.equal(requests[0].name,'corporate_register_account');assert.deepEqual(requests[0].args,{p_details:{...details,contact_phone:'+27 21 555 1234'}});
  await assert.rejects(actions.registerCorporateAccount({...details,contact_phone:'.......'}),/valid contact email/);assert.equal(requests.length,1);
  await actions.searchCorporateAccounts(' test ','Rejected',3);assert.deepEqual(requests[1].args,{p_query:'test',p_status:'Rejected',p_offset:20,p_limit:10});
  await actions.searchVolunteerDirectory(' Taylor ','missing',2);assert.equal(requests[2].args.p_offset,10);
  await assert.rejects(actions.reviewCorporateAccount('id','approve',' '),/reason/);assert.equal(requests.length,3);
  const missing=modules({rpc:async()=>({data:null,error:{code:'PGRST202',message:'Function not found'}})}).load('lib/actions/corporate-accounts.ts');
  await assert.rejects(missing.getCorporateRolloutSettings(),/temporarily unavailable/);
  const empty=modules({rpc:async()=>({data:null,error:null})}).load('lib/actions/corporate-accounts.ts');await assert.rejects(empty.getCorporateRolloutSettings(),/no result/);
  const closed=modules({rpc:async()=>({data:{schema_version:1,registration_enabled:false},error:null})}).load('lib/actions/corporate-accounts.ts');await assert.rejects(closed.requireCorporateRegistrationOpen(),/not open yet/);
  const incompatible=modules({rpc:async()=>({data:{schema_version:2,registration_enabled:true},error:null})}).load('lib/actions/corporate-accounts.ts');await assert.rejects(incompatible.requireCorporateRegistrationOpen(),/not open yet/);
});

test('account routing recognises corporate membership without changing a volunteer role or hiding query errors',async()=>{
  const seen=[];const member=modules({from:table=>{const chain={select:()=>chain,eq:(key,value)=>{seen.push([table,key,value]);return chain;},maybeSingle:async()=>({data:{id:'company'},error:null})};return chain;}});
  assert.equal(await member.load('lib/actions/account-routing.ts').accountLandingPath('volunteer'),'/corporate');assert.deepEqual(seen,[['corporate_accounts','owner_user_id','owner']]);
  const absent=modules({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})})});
  assert.equal(await absent.load('lib/actions/account-routing.ts').accountLandingPath('volunteer',true),'/corporate/register');
  const failed=modules({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:{message:'Access lookup failed'}})})});
  await assert.rejects(failed.load('lib/actions/account-routing.ts').accountLandingPath('volunteer'),/Access lookup failed/);
});

test('real UI exposes foundation routes only with the flag and the account form includes contact/billing fields',()=>{
  const enabled=modules(),disabled=modules({enabled:false});
  const form=enabled.load('app/corporate/components/CorporateAccountForm.tsx').default;
  const markup=renderToStaticMarkup(React.createElement(form,{submit:async()=>{}},React.createElement('p',{},'Verification instructions')));
  for(const text of ['Company / organisation','Main point of contact','Contact email','Contact phone','Full billing address','Create a password'])assert.ok(markup.includes(text),text);
  const sidebarOn=renderToStaticMarkup(React.createElement(enabled.load('app/admin/components/Sidebar.tsx').default));
  const sidebarOff=renderToStaticMarkup(React.createElement(disabled.load('app/admin/components/Sidebar.tsx').default));
  assert.match(sidebarOn,/Volunteer directory|Corporate accounts/);assert.doesNotMatch(sidebarOff,/Volunteer directory|Corporate accounts/);
  assert.match(renderToStaticMarkup(React.createElement(enabled.load('app/components/LoginForm.tsx').default)),/Business registration/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(disabled.load('app/components/LoginForm.tsx').default)),/Business registration/);
  assert.match(renderToStaticMarkup(React.createElement(disabled.load('app/corporate/register/page.tsx').default)),/not open yet/);
});

test('change APIs stay separately gated and carry original/target versions and a retry key',async()=>{
  let calls=0;const off=modules({bookings:true,rpc:async()=>{calls++;return {data:{},error:null};}}).load('lib/actions/corporate-bookings.ts');
  await assert.rejects(off.configureCorporateChanges(true),/changes are not enabled/);assert.equal(calls,0);
  const requests=[],m=modules({bookings:true,changes:true,rpc:async(name,args)=>{requests.push({name,args});return {data:{id:'booking'},error:null};}}),actions=m.load('lib/actions/corporate-bookings.ts');
  await actions.requestCorporateChange({id:'booking',version:6},'Amendment',{id:'target',version:3},7,' Reason ','key');
  assert.deepEqual(requests[0],{name:'corporate_request_change',args:{p_booking_id:'booking',p_version:6,p_kind:'Amendment',p_target_id:'target',p_target_version:3,p_size:7,p_reason:'Reason',p_request_key:'key'}});
  await actions.reviewCorporateChange({id:'booking',version:7},'change',true,' External follow-up ',1250.5,'2099-11-14T10:00:00+02:00');
  assert.equal(requests[1].args.p_amount,1250.5);assert.equal(requests[1].args.p_change_id,'change');assert.equal(requests[1].args.p_version,7);
  await actions.cancelCorporateEvent({id:'event',version:4},' Venue closed ');assert.deepEqual(requests[2].args,{p_event_id:'event',p_version:4,p_reason:'Venue closed'});
  await assert.rejects(actions.reviewCorporateChange({id:'booking',version:7},'change',true,'Note',0),/positive ZAR/);
  const missing=modules({bookings:true,changes:true,rpc:async()=>({data:{booking_schema_version:1},error:null})}).load('lib/actions/corporate-bookings.ts');
  await assert.rejects(missing.getCorporateBookingSettings(),/change requests are temporarily unavailable/);
});

test('real change UI exposes owner proposals, admin review, history and external-only payment controls',()=>{
  const m=modules({bookings:true,changes:true}),event={id:'event',version:1,title:'Original session',starts_at:'2099-11-15T09:15:00+02:00',ends_at:'2099-11-15T10:15:00+02:00',location:'Example venue'};
  const booking={id:'booking',version:4,event_id:event.id,event,status:'Confirmed',group_size:7,payment_due_at:null};
  const actions=m.load('app/corporate/components/CorporateChangeActions.tsx');
  const owner=renderToStaticMarkup(React.createElement(actions.default,{booking,admin:false,settings:{changes_enabled:true},dirtyChanged(){},committed:async()=>{}}));
  assert.match(owner,/Request booking change/);assert.match(owner,/Request cancellation/);assert.doesNotMatch(owner,/Review &amp; approve/);
  const proposal={id:'change',kind:'Amendment',status:'Requested',reason:'Different group size',created_at:'2026-10-21T12:00:00Z',target_snapshot:event,proposed_size:5};
  const admin=renderToStaticMarkup(React.createElement(actions.default,{booking:{...booking,pending_change:proposal},admin:true,settings:{changes_enabled:true},dirtyChanged(){},committed:async()=>{}}));
  assert.match(admin,/Review &amp; approve amendment/);assert.match(admin,/Decline amendment/);assert.match(admin,/Proposed places are not reserved/);
  const review=renderToStaticMarkup(React.createElement(actions.CorporateChangeReviewForm,{booking:{...booking,pending_change:proposal},approve:true,dirtyChanged(){},committed:async()=>{}}));
  assert.match(review,/Additional external payment agreed/);assert.match(review,/Earlier payments stay recorded/);
  const cancel=renderToStaticMarkup(React.createElement(m.load('app/corporate/components/CorporateCancellationControls.tsx').CorporateCancelEventForm,{event,dirtyChanged(){},committed(){}}));
  assert.match(cancel,/Cancel event &amp; open bookings/);assert.match(cancel,/Refunds must be arranged externally/);
  const afterStart=renderToStaticMarkup(React.createElement(actions.default,{booking:{...booking,event:{...event,starts_at:'2020-11-15T09:15:00+02:00'}},admin:false,settings:{changes_enabled:true},dirtyChanged(){},committed:async()=>{}}));
  assert.doesNotMatch(afterStart,/Request booking change|Request cancellation/);assert.match(afterStart,/close at the event start/);
});

// Small hook fixture: exercise the actual submit handler without a DOM, hosted Auth or a network call.
function formHooks(){
  const state=[];let cursor=0;
  const hooks={
    useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
    useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];},
    useCallback(callback){return callback;},useEffect(){},
  };
  return {hooks,render:(component,props)=>{cursor=0;return component(props);}};
}
function formNodes(tree){return Array.isArray(tree)?tree.flatMap(formNodes):tree?.props?[tree,...formNodes(tree.props.children)]:[];}

test('real cancellation submit prevents double clicks and reuses the intent key after a lost response',async t=>{
  const oldWindow=globalThis.window;globalThis.window={confirm:()=>true};t.after(()=>{globalThis.window=oldWindow;});
  let resolveFirst;const requests=[],saved=[],fixture=formHooks();
  const m=modules({bookings:true,changes:true,hooks:fixture.hooks,rpc:async(name,args)=>{requests.push({name,args});return requests.length===1?await new Promise(resolve=>{resolveFirst=resolve;}):{data:{id:'booking'},error:null};}});
  const form=m.load('app/corporate/components/CorporateChangeActions.tsx').CorporateChangeRequestForm;
  const props={booking:{id:'booking',version:3,group_size:5,event:{title:'Session',starts_at:'2099-11-15T09:00:00Z'}},kind:'Cancellation',dirtyChanged(){},committed:async result=>{saved.push(result);}};
  let tree=fixture.render(form,props);formNodes(tree).find(node=>node.type==='textarea').props.onChange({target:{value:'Please cancel.'}});
  tree=fixture.render(form,props);const submit=formNodes(tree).find(node=>node.type==='form').props.onSubmit;
  const first=submit({preventDefault(){}});await submit({preventDefault(){}});assert.equal(requests.length,1);
  resolveFirst({data:null,error:{message:'Connection lost'}});await first;assert.equal(saved.length,0);
  tree=fixture.render(form,props);await formNodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(requests.length,2);assert.equal(requests[0].args.p_request_key,requests[1].args.p_request_key);assert.equal(saved.length,1);
});

test('declined confirmation sends no corporate change or event cancellation write',async t=>{
  const oldWindow=globalThis.window;globalThis.window={confirm:()=>false};t.after(()=>{globalThis.window=oldWindow;});
  let calls=0;const fixture=formHooks(),m=modules({bookings:true,changes:true,hooks:fixture.hooks,rpc:async()=>{calls++;return {data:{},error:null};}});
  const form=m.load('app/corporate/components/CorporateCancellationControls.tsx').CorporateCancelEventForm;
  const tree=fixture.render(form,{event:{title:'Session',starts_at:'2099-11-15T09:00:00Z'},dirtyChanged(){},committed(){}});
  await formNodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(calls,0);
});

test('attendance/report contracts respect emergency switches and a missing schema is never treated as ready',async()=>{
  let calls=0;const off=modules({rpc:async()=>{calls++;return {data:{},error:null};}}).load('lib/actions/corporate-outcomes.ts');
  await assert.rejects(off.getCorporateOutcomeReport({query:'',from:'',to:''}),/not enabled yet/);assert.equal(calls,0);
  const on=modules({bookings:true,changes:true,outcomes:true,rpc:async()=>({data:{booking_schema_version:1,changes_schema_version:1},error:null})}).load('lib/actions/corporate-bookings.ts');
  await assert.rejects(on.getCorporateBookingSettings(),/temporarily unavailable/);
  const missing=modules({bookings:true,changes:true,outcomes:true,rpc:async()=>({data:null,error:{code:'PGRST202',message:'Missing'}})}).load('lib/actions/corporate-outcomes.ts');
  await assert.rejects(missing.getCorporateOutcomeReport({query:'',from:'',to:''}),/temporarily unavailable/);
});

test('report export loads every page, checks a full-scope revision and rejects missing, duplicate or changed pages',async()=>{
  const filters={query:'Example',from:'',to:'',status:''};
  const report=(offset,snapshot='v1')=>({rows:Array.from({length:offset?5:10},(_,i)=>({id:'booking-'+(offset+i)})),total:15,snapshot,summary:{bookings:15,accepted_places:50,completed_groups:3,attendance_instances:20,group_hours:0,groups_without_hours:3,overdue_bookings:0}});
  let calls=0;const full=modules({bookings:true,changes:true,outcomes:true,rpc:async(name,args)=>{assert.equal(name,'corporate_outcome_report');calls++;return {data:report(args.p_offset),error:null};}}).load('lib/actions/corporate-outcomes.ts');
  const rows=await full.loadAllCorporateOutcomeRows(filters);assert.equal(rows.length,15);assert.equal(calls,3);
  for(const type of ['changed','missing','duplicate']){
    const bad=modules({bookings:true,changes:true,outcomes:true,rpc:async(name,args)=>{const data=report(args.p_offset,args.p_offset&&type==='changed'?'v2':'v1');if(args.p_offset&&type==='missing')data.rows=[];if(args.p_offset&&type==='duplicate')data.rows[0].id='booking-0';return {data,error:null};}}).load('lib/actions/corporate-outcomes.ts');
    await assert.rejects(bad.loadAllCorporateOutcomeRows(filters),/changed|incomplete|Duplicate/);
  }
});

test('real attendance form blocks duplicate submit and preserves blank hours on a lost-response retry',async t=>{
  const oldWindow=globalThis.window;globalThis.window={confirm:()=>true};t.after(()=>{globalThis.window=oldWindow;});
  const fixture=formHooks(),requests=[];let resolveFirst;
  const m=modules({bookings:true,changes:true,outcomes:true,hooks:fixture.hooks,rpc:async(name,args)=>{requests.push({name,args});return requests.length===1?await new Promise(resolve=>{resolveFirst=resolve;}):{data:{id:'booking'},error:null};}});
  const form=m.load('app/corporate/components/CorporateAttendance.tsx').CorporateAttendanceForm;
  const props={booking:{id:'booking',version:4,group_size:10,status:'Confirmed',event:{ends_at:'2020-11-15T10:00:00Z'}},dirtyChanged(){},committed:async()=>{}};
  let tree=fixture.render(form,props);formNodes(tree).find(node=>node.type==='input'&&node.props.required).props.onChange({target:{value:'5'}});formNodes(tree).find(node=>node.type==='textarea').props.onChange({target:{value:'Counted the group.'}});
  tree=fixture.render(form,props);const submit=formNodes(tree).find(node=>node.type==='form').props.onSubmit;
  const first=submit({preventDefault(){}});await submit({preventDefault(){}});assert.equal(requests.length,1);assert.equal(requests[0].args.p_hours,null);assert.equal(requests[0].args.p_version,4);
  resolveFirst({data:null,error:{message:'Connection lost'}});await first;tree=fixture.render(form,props);await formNodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(requests.length,2);assert.equal(requests[0].args.p_request_key,requests[1].args.p_request_key);
});
