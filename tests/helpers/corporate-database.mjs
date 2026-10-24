import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// A tiny existing-VMS schema, plus the real migrations. No hosted credentials or network.
export const ids={admin:'00000000-0000-4000-8000-000000000001',owner:'00000000-0000-4000-8000-000000000002',other:'00000000-0000-4000-8000-000000000003',unverified:'00000000-0000-4000-8000-000000000004',admin2:'00000000-0000-4000-8000-000000000005',signup:'00000000-0000-4000-8000-000000000006'};
export const details={company_name:'Example Business',contact_name:'Example Contact',contact_email:'contact@example.invalid',contact_phone:'+27 21 555 1234',billing_address:'12 Fictional Street, Cape Town, 8000'};
export async function fixture(t,{bookings=false,changes=false,outcomes=false,separation=false}={}){
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table public.profiles(id uuid primary key references auth.users(id),full_name text not null,email text,role text not null check(role in ('admin','volunteer')),date_of_birth date,avatar_path text);
    create table public.bookings(id bigint generated always as identity primary key,user_id uuid references auth.users(id));
    create table public.events(id bigint primary key,title text);
    create table public.event_slots(id bigint primary key,event_id bigint references public.events(id),capacity integer);
    create table public.corporate_bookings(id bigint primary key,event_slot_id bigint references public.event_slots(id),team_size integer);
    insert into public.events values(1,'Existing WMS event'); insert into public.event_slots values(1,1,6); insert into public.corporate_bookings values(1,1,2);
    create function public.book_event_slot(p_event_slot_id bigint) returns text language sql as $$select 'legacy capacity implementation preserved'::text$$;
    create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
    create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,full_name,email,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','New Volunteer'),new.email,'volunteer'); return new;end$$;
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
    alter table public.profiles enable row level security;
    grant select,update,insert on public.profiles to authenticated;
    create policy profiles_own_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
    create policy profiles_own_write on public.profiles for update to authenticated using(id=auth.uid() and role='volunteer') with check(id=auth.uid() and role='volunteer');
    insert into auth.users(id,email,email_confirmed_at) values
      ('${ids.admin}','admin@example.invalid',now()),('${ids.owner}','owner@example.invalid',now()),
      ('${ids.other}','other@example.invalid',now()),('${ids.unverified}','unverified@example.invalid',null),('${ids.admin2}','admin2@example.invalid',now());
    update public.profiles set role='admin' where id in ('${ids.admin}','${ids.admin2}');
  `);
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261022091901_corporate_account_foundation.sql',import.meta.url),'utf8'));
  if(bookings||changes||outcomes||separation)await db.exec(readFileSync(new URL('../../supabase/migrations/20261022091921_corporate_booking_workflow.sql',import.meta.url),'utf8'));
  if(changes||outcomes||separation)await db.exec(readFileSync(new URL('../../supabase/migrations/20261022091927_corporate_booking_changes.sql',import.meta.url),'utf8'));
  if(outcomes||separation)await db.exec(readFileSync(new URL('../../supabase/migrations/20261022091932_corporate_attendance_reports.sql',import.meta.url),'utf8'));
  if(separation)await db.exec(readFileSync(new URL('../../supabase/migrations/20261022162335_separate_corporate_accounts.sql',import.meta.url),'utf8'));
  return db;
}
export async function asUser(db,id,operation,role='authenticated'){
  await db.exec('begin');
  try{
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
    await db.exec('set local role '+role);
    const result=await operation();await db.exec('commit');return result;
  }catch(error){await db.exec('rollback');throw error;}
}
export async function rpc(db,name,args=[]){
  const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');
  return (await db.query(`select public.${name}(${placeholders}) as result`,args)).rows[0].result;
}
export async function openRegistration(db){await asUser(db,ids.admin,()=>rpc(db,'corporate_set_rollout_settings',[true,false]));}
export async function register(db,id=ids.owner,input=details){return asUser(db,id,()=>rpc(db,'corporate_register_account',[JSON.stringify(input)]));}
