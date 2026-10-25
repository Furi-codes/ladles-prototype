-- Personal in-app reminders. Booking decisions/cancellations are mandatory inbox history.
begin;

create table public.personal_reminder_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  portal text not null check(portal in ('volunteer','corporate')),
  reminder_24h boolean not null default true,
  reminder_2h boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id,portal)
);
alter table public.personal_reminder_preferences enable row level security;
revoke all on public.personal_reminder_preferences from public,anon,authenticated;
grant select on public.personal_reminder_preferences to authenticated;
create policy personal_reminders_read_own on public.personal_reminder_preferences
  for select to authenticated using(user_id=(select auth.uid()));

-- Corporate notices share the existing inbox and Go to booking action.
alter table public.corporate_account_notifications
  add column reminder_hours smallint check(reminder_hours in (24,2)),
  add column reminder_session_start timestamptz;
alter table public.corporate_account_notifications add constraint corporate_reminder_fields check(
  (reminder_hours is null and reminder_session_start is null) or
  (reminder_hours is not null and reminder_session_start is not null and audience='corporate' and target_kind='booking' and target_id is not null)
);
create unique index corporate_session_reminder_once on public.corporate_account_notifications
  (target_id,reminder_session_start,reminder_hours) where reminder_hours is not null;

-- These privileged helpers accept no user ID; the caller can only change their own account.
create function notification_private.reminder_user(p_portal text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user();
begin
  if p_portal is null or p_portal not in ('volunteer','corporate') then
    raise exception 'Choose a valid portal.' using errcode='22023';
  end if;
  if p_portal='corporate' and not exists(select 1 from public.corporate_accounts where owner_user_id=v_user)
    or p_portal='volunteer' and not exists(select 1 from public.profiles where id=v_user and role='volunteer' and volunteer_enabled) then
    raise exception 'This account cannot manage these reminder preferences.' using errcode='42501';
  end if;
  return v_user;
end $$;

create function notification_private.get_reminder_preferences(p_portal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=notification_private.reminder_user(p_portal); result jsonb; legacy_enabled boolean:=true;
begin
  if p_portal='volunteer' then
    select coalesce((select reminders_enabled from public.volunteer_notification_preferences where user_id=v_user),true) into legacy_enabled;
  end if;
  select jsonb_build_object('portal',p_portal,'reminder_24h',reminder_24h,'reminder_2h',reminder_2h)
    into result from public.personal_reminder_preferences where user_id=v_user and portal=p_portal;
  return coalesce(result,jsonb_build_object('portal',p_portal,'reminder_24h',legacy_enabled,'reminder_2h',legacy_enabled));
end $$;

create function notification_private.set_reminder_preferences(p_portal text,p_24h boolean,p_2h boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=notification_private.reminder_user(p_portal);
begin
  if p_24h is null or p_2h is null then raise exception 'Choose both reminder preferences.' using errcode='22023'; end if;
  -- Serialize saves with generation, including the first save when no preference row exists.
  perform pg_catalog.pg_advisory_xact_lock(864102501);
  insert into public.personal_reminder_preferences(user_id,portal,reminder_24h,reminder_2h)
    values(v_user,p_portal,p_24h,p_2h) on conflict(user_id,portal) do update
    set reminder_24h=excluded.reminder_24h,reminder_2h=excluded.reminder_2h,updated_at=now();
  if p_portal='volunteer' then
    -- Keep the previous app's boolean reader/writer compatible during deployment.
    insert into public.volunteer_notification_preferences(user_id,reminders_enabled) values(v_user,p_24h or p_2h)
      on conflict(user_id) do update set reminders_enabled=excluded.reminders_enabled;
    update public.notifications set is_read=true where user_id=v_user and not is_read
      and (type='shift_reminder_24h' and not p_24h or type='shift_reminder_2h' and not p_2h);
  else
    insert into public.corporate_account_notification_reads(user_id,notification_id)
      select v_user,n.id from public.corporate_account_notifications n join public.corporate_accounts a on a.id=n.account_id
      where a.owner_user_id=v_user and n.audience='corporate'
        and (n.reminder_hours=24 and not p_24h or n.reminder_hours=2 and not p_2h)
      on conflict do nothing;
  end if;
  return notification_private.get_reminder_preferences(p_portal);
end $$;

create function public.get_personal_reminder_preferences(p_portal text) returns jsonb
language sql security invoker set search_path='' as $$select notification_private.get_reminder_preferences(p_portal)$$;
create function public.set_personal_reminder_preferences(p_portal text,p_24h boolean,p_2h boolean) returns jsonb
language sql security invoker set search_path='' as $$select notification_private.set_reminder_preferences(p_portal,p_24h,p_2h)$$;
create or replace function public.set_volunteer_reminder_preference(p_enabled boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  perform notification_private.set_reminder_preferences('volunteer',p_enabled,p_enabled);
  return p_enabled;
end $$;

create or replace function notification_private.generate_shift_reminders(p_now timestamptz default now()) returns integer
language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(864102501);
  -- Mark stale/disabled reminders read; never remove cancellation updates or inbox history.
  update public.notifications n set is_read=true
  where n.type in ('shift_reminder_24h','shift_reminder_2h') and not n.is_read and not exists(
    select 1 from public.bookings b join public.events e on e.id=b.event_id join public.event_slots s on s.id=b.event_slot_id
    left join public.personal_reminder_preferences p on p.user_id=b.user_id and p.portal='volunteer'
    left join public.volunteer_notification_preferences old on old.user_id=b.user_id
    where b.user_id=n.user_id and b.event_id=n.event_id and b.status='Confirmed' and e.status<>'Cancelled'
      and ((e.date+s.start_time) at time zone 'Africa/Johannesburg')=n.scheduled_for and n.scheduled_for>p_now
      and case when n.type='shift_reminder_24h' then coalesce(p.reminder_24h,old.reminders_enabled,true)
        else coalesce(p.reminder_2h,old.reminders_enabled,true) end
  );
  -- The legacy organisation switch no longer overrides a person's preferences.
  with upcoming as(
    select b.user_id,e.id event_id,e.title,e.location,
      (e.date+s.start_time) at time zone 'Africa/Johannesburg' starts_at,
      coalesce(p.reminder_24h,old.reminders_enabled,true) reminder_24h,
      coalesce(p.reminder_2h,old.reminders_enabled,true) reminder_2h
    from public.bookings b join public.events e on e.id=b.event_id join public.event_slots s on s.id=b.event_slot_id
    left join public.personal_reminder_preferences p on p.user_id=b.user_id and p.portal='volunteer'
    left join public.volunteer_notification_preferences old on old.user_id=b.user_id
    where b.status='Confirmed' and e.status<>'Cancelled'
      and e.date between (p_now at time zone 'Africa/Johannesburg')::date and ((p_now+interval '24 hours') at time zone 'Africa/Johannesburg')::date
  ), due as(
    select *,case when starts_at<=p_now+interval '2 hours' then 'shift_reminder_2h' else 'shift_reminder_24h' end reminder_type
    from upcoming where starts_at>p_now and starts_at<=p_now+interval '24 hours'
      and case when starts_at<=p_now+interval '2 hours' then reminder_2h else reminder_24h end
  ), nearest as(
    select distinct on(user_id,event_id,reminder_type) * from due order by user_id,event_id,reminder_type,starts_at
  )
  insert into public.notifications(user_id,event_id,type,title,message,scheduled_for,created_at)
    select user_id,event_id,reminder_type,
      case when reminder_type='shift_reminder_2h' then 'Starting soon: ' else 'Upcoming shift: ' end||title,
      'Your booked shift starts on '||to_char(starts_at at time zone 'Africa/Johannesburg','DD Mon YYYY "at" HH24:MI')
        ||' at '||location||'. Open your booked shift for details. Please clock in when you arrive.',starts_at,p_now
    from nearest on conflict(event_id,user_id,type) do update set title=excluded.title,message=excluded.message,
      scheduled_for=excluded.scheduled_for,is_read=false,created_at=p_now
      where public.notifications.scheduled_for is distinct from excluded.scheduled_for;
  get diagnostics inserted=row_count;
  return inserted;
end $$;

create function notification_private.generate_corporate_reminders(p_now timestamptz default now()) returns integer
language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(864102501);
  -- Rescheduling/cancellation/opt-out clears the unread reminder, retaining the historical message.
  insert into public.corporate_account_notification_reads(user_id,notification_id)
    select a.owner_user_id,n.id from public.corporate_account_notifications n
    join public.corporate_accounts a on a.id=n.account_id
    where n.reminder_hours is not null and not exists(
      select 1 from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id
      join auth.users u on u.id=a.owner_user_id
      left join public.personal_reminder_preferences p on p.user_id=a.owner_user_id and p.portal='corporate'
      where b.id=n.target_id and b.account_id=a.id and b.status='Confirmed' and a.status='Approved'
        and u.email_confirmed_at is not null and e.cancelled_at is null and e.starts_at>p_now and e.starts_at=n.reminder_session_start
        and case when n.reminder_hours=24 then coalesce(p.reminder_24h,true) else coalesce(p.reminder_2h,true) end
    ) on conflict do nothing;
  insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind,target_id,reminder_hours,reminder_session_start,created_at)
    select b.account_id,'corporate',case when e.starts_at<=p_now+interval '2 hours' then 'Session starting soon' else 'Upcoming session' end,
      e.title||' · '||to_char(e.starts_at at time zone 'Africa/Johannesburg','DD Mon YYYY HH24:MI')||' (SA time) · '||e.location||'. View your booking before attending.',
      'booking',b.id,case when e.starts_at<=p_now+interval '2 hours' then 2 else 24 end,e.starts_at,p_now
    from public.corporate_reservations b join public.corporate_events e on e.id=b.event_id
    join public.corporate_accounts a on a.id=b.account_id join auth.users u on u.id=a.owner_user_id
    left join public.personal_reminder_preferences p on p.user_id=a.owner_user_id and p.portal='corporate'
    where b.status='Confirmed' and a.status='Approved' and u.email_confirmed_at is not null and e.cancelled_at is null
      and e.starts_at>p_now and e.starts_at<=p_now+interval '24 hours'
      and case when e.starts_at<=p_now+interval '2 hours' then coalesce(p.reminder_2h,true) else coalesce(p.reminder_24h,true) end
    on conflict(target_id,reminder_session_start,reminder_hours) where reminder_hours is not null do nothing;
  get diagnostics inserted=row_count;
  return inserted;
end $$;

revoke all on function notification_private.reminder_user(text),notification_private.get_reminder_preferences(text),notification_private.set_reminder_preferences(text,boolean,boolean),notification_private.generate_shift_reminders(timestamptz),notification_private.generate_corporate_reminders(timestamptz),public.get_personal_reminder_preferences(text),public.set_personal_reminder_preferences(text,boolean,boolean) from public,anon,authenticated;
grant usage on schema notification_private to authenticated;
grant execute on function notification_private.get_reminder_preferences(text),notification_private.set_reminder_preferences(text,boolean,boolean),public.get_personal_reminder_preferences(text),public.set_personal_reminder_preferences(text,boolean,boolean) to authenticated;
revoke all on function public.set_volunteer_reminder_preference(boolean) from public,anon;
grant execute on function public.set_volunteer_reminder_preference(boolean) to authenticated;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('vms-corporate-session-reminders','*/5 * * * *','select notification_private.generate_corporate_reminders();');
  end if;
end $$;
notify pgrst,'reload schema';
commit;
