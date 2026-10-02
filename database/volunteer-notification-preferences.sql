begin;
create table public.volunteer_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 reminders_enabled boolean not null default true
);
alter table public.volunteer_notification_preferences enable row level security;
revoke all on public.volunteer_notification_preferences from public,anon,authenticated;
grant select on public.volunteer_notification_preferences to authenticated;
grant insert(user_id,reminders_enabled),update(reminders_enabled) on public.volunteer_notification_preferences to authenticated;
create policy notification_preferences_read_own on public.volunteer_notification_preferences
 for select to authenticated using (user_id=(select auth.uid()));
create policy notification_preferences_insert_own on public.volunteer_notification_preferences
 for insert to authenticated with check (user_id=(select auth.uid()));
create policy notification_preferences_update_own on public.volunteer_notification_preferences
 for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create function public.set_volunteer_reminder_preference(p_enabled boolean)
returns boolean language plpgsql security invoker set search_path=''
as $function$
begin
 if auth.uid() is null then raise exception 'Please sign in to change notification preferences.'; end if;
 if p_enabled is null then raise exception 'Choose whether reminders are enabled.'; end if;
 insert into public.volunteer_notification_preferences(user_id,reminders_enabled)
 values(auth.uid(),p_enabled) on conflict(user_id) do update set reminders_enabled=excluded.reminders_enabled;
 if not p_enabled then
  update public.notifications set is_read=true where user_id=auth.uid()
   and type in ('shift_reminder_24h','shift_reminder_2h') and not is_read;
 end if;
 return p_enabled;
end;
$function$;
revoke all on function public.set_volunteer_reminder_preference(boolean) from public,anon;
grant execute on function public.set_volunteer_reminder_preference(boolean) to authenticated;

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
  and coalesce((select reminders_enabled from public.volunteer_notification_preferences where user_id=b.user_id),true)
 );
 if not coalesce((select shift_reminder_enabled from public.organisation_settings where id=1),false) then return 0; end if;
 with upcoming as (
  select b.user_id,e.id event_id,e.title,e.location,
   (e.date+s.start_time) at time zone 'Africa/Johannesburg' starts_at
  from public.bookings b join public.events e on e.id=b.event_id
  join public.event_slots s on s.id=b.event_slot_id
  where b.status='Confirmed' and e.status<>'Cancelled'
   and coalesce((select reminders_enabled from public.volunteer_notification_preferences where user_id=b.user_id),true)
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

notify pgrst,'reload schema';
commit;
