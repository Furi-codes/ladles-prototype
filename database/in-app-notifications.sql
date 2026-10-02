begin;
create schema if not exists notification_private;
revoke all on schema notification_private from public, anon, authenticated;
alter table public.notifications add column if not exists scheduled_for timestamptz;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
 check (type in ('event_cancelled','shift_reminder_24h','shift_reminder_2h'));
create index if not exists notifications_user_inbox_idx on public.notifications(user_id,created_at desc,id desc);
-- Clients may only read authorised rows and change their read flag.
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update(is_read) on public.notifications to authenticated;

create or replace function notification_private.generate_shift_reminders(p_now timestamptz default now())
returns integer language plpgsql security invoker set search_path = ''
as $function$
declare v_count integer;
begin
 -- Clear stale unread reminders without deleting the history.
 update public.notifications n set is_read = true
 where n.type in ('shift_reminder_24h','shift_reminder_2h') and not n.is_read
 and not exists (
  select 1 from public.bookings b join public.events e on e.id=b.event_id
  join public.event_slots s on s.id=b.event_slot_id
  where b.user_id=n.user_id and b.event_id=n.event_id and b.status='Confirmed' and e.status<>'Cancelled'
  and ((e.date+s.start_time) at time zone 'Africa/Johannesburg')=n.scheduled_for
  and n.scheduled_for>p_now
 );
 if not coalesce((select shift_reminder_enabled from public.organisation_settings where id=1),false) then return 0; end if;
 with upcoming as (
  select b.user_id,e.id event_id,e.title,e.location,
   (e.date+s.start_time) at time zone 'Africa/Johannesburg' starts_at
  from public.bookings b join public.events e on e.id=b.event_id
  join public.event_slots s on s.id=b.event_slot_id
  where b.status='Confirmed' and e.status<>'Cancelled'
   and e.date between (p_now at time zone 'Africa/Johannesburg')::date and ((p_now+interval '24 hours') at time zone 'Africa/Johannesburg')::date
 ), due as (
  select *,case when starts_at<=p_now+interval '2 hours' then 'shift_reminder_2h' else 'shift_reminder_24h' end reminder_type
  from upcoming where starts_at>p_now and starts_at<=p_now+interval '24 hours'
 )
 insert into public.notifications(user_id,event_id,type,title,message,scheduled_for)
 select user_id,event_id,reminder_type,
  case when reminder_type='shift_reminder_2h' then 'Starting soon: ' else 'Upcoming shift: ' end || title,
  'Your booked shift starts on ' || to_char(starts_at at time zone 'Africa/Johannesburg','DD Mon YYYY "at" HH24:MI')
   || ' at ' || location || '. Open your booked shift for details. Please clock in when you arrive.',
  starts_at
 from due
 on conflict(event_id,user_id,type) do update set title=excluded.title,message=excluded.message,
  scheduled_for=excluded.scheduled_for,is_read=false,created_at=p_now
 where public.notifications.scheduled_for is distinct from excluded.scheduled_for;
 get diagnostics v_count = row_count;
 return v_count;
end;
$function$;
revoke all on function notification_private.generate_shift_reminders(timestamptz) from public,anon,authenticated;
do $publication$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end;
$publication$;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('vms-in-app-shift-reminders','*/5 * * * *','select notification_private.generate_shift_reminders();');
notify pgrst,'reload schema';
commit;
