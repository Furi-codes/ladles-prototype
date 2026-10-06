-- REVIEW WITH DATABASE ADMINISTRATOR BEFORE RUNNING. NOT APPLIED BY CODEX.
-- Requires the existing CSR and admin-access migrations; do not rerun them.
begin;

-- Preserve individual capacity and every booking. Corporate limits are independent.
-- New slots default to closed for corporate bookings until an admin sets a limit.
alter table public.event_slots add column corporate_capacity integer not null default 0
  check (corporate_capacity >= 0);
-- Existing shifts retain their old maximum group limit, never below retained teams.
-- Table lock from ALTER TABLE makes this backfill atomic with function replacement.
update public.event_slots s
set corporate_capacity = greatest(s.capacity, public.csr_reserved_spaces(s.id));
comment on column public.event_slots.capacity is 'Individual volunteer capacity only';
comment on column public.event_slots.corporate_capacity is 'Independent corporate team capacity; non-cancelled team sizes reserve places';

create or replace function public.save_corporate_booking(
  p_id bigint, p_company_id bigint, p_event_slot_id bigint, p_team_size integer,
  p_status text, p_contact_name text, p_contact_email text, p_notes text,
  p_attendance_count integer default null, p_volunteer_hours numeric default null
) returns public.corporate_bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.corporate_bookings%rowtype;
  v_slot public.event_slots%rowtype;
  v_event public.events%rowtype;
  v_result public.corporate_bookings%rowtype;
  v_new_reservation boolean;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Only administrators can manage corporate bookings.'; end if;
  -- Slot locks serialize writers, but cannot refresh a REPEATABLE READ snapshot.
  -- PostgreSQL READ UNCOMMITTED has the same snapshot semantics as READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Capacity mutations require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  if p_team_size is null or p_team_size <= 0 then raise exception 'Team size must be a positive integer.'; end if;
  if p_status is null or p_status not in ('Pending','Confirmed','Completed','Cancelled') then raise exception 'Invalid corporate booking status.'; end if;
  -- Validate raw hours before numeric(12,2) rounding can turn -0.001 or 0.001 into zero.
  -- The table constraint still enforces NULL, NaN, bounds and status combinations.
  if p_volunteer_hours < 0 or (p_attendance_count = 0 and p_volunteer_hours > 0) then
    raise exception 'Hours must be nonnegative and must be zero when attendance is zero.';
  end if;
  if not exists (select 1 from public.corporate_companies where id = p_company_id) then raise exception 'Company no longer exists.'; end if;
  if p_id is not null then
    select * into v_old from public.corporate_bookings where id = p_id for update;
    if not found then raise exception 'Corporate booking no longer exists.'; end if;
  elsif p_status not in ('Pending','Confirmed') then
    raise exception 'New bookings must be Pending or Confirmed.';
  end if;
  -- Deterministic order prevents opposing moves from locking slots in reverse order.
  perform id from public.event_slots where id in (p_event_slot_id, v_old.event_slot_id) order by id for update;
  select * into v_slot from public.event_slots where id = p_event_slot_id for update;
  if not found then raise exception 'This event slot no longer exists.'; end if;
  select * into v_event from public.events where id = v_slot.event_id;
  if not found then raise exception 'This event no longer exists.'; end if;
  v_new_reservation := p_id is null or p_event_slot_id <> v_old.event_slot_id
    or p_team_size > v_old.team_size or (v_old.status = 'Cancelled' and p_status <> 'Cancelled');
  if v_new_reservation then
    if v_event.status = 'Cancelled' then raise exception 'This event has been cancelled and can no longer be booked.'; end if;
    if v_event.date is null
      or v_event.date::date < (now() at time zone 'Africa/Johannesburg')::date
      or (v_event.date::date = (now() at time zone 'Africa/Johannesburg')::date
        and v_slot.end_time <= (now() at time zone 'Africa/Johannesburg')::time) then
      raise exception 'This event slot has already ended and cannot be booked.';
    end if;
  end if;
  if p_status = 'Completed' then
    if v_event.status = 'Cancelled' or v_event.date is null
       or (v_event.date::date + v_slot.end_time) > (now() at time zone 'Africa/Johannesburg') then
      raise exception 'Attendance can only be completed for an ended, non-cancelled shift.';
    end if;
  end if;
  if v_old.status = 'Completed' and (p_status <> 'Completed' or p_event_slot_id <> v_old.event_slot_id or p_company_id <> v_old.company_id or p_team_size <> v_old.team_size) then
    raise exception 'Completed booking identity and reservation must be retained; only correct attendance or contact details.';
  end if;
  if p_status <> 'Cancelled' then
    if public.csr_reserved_spaces(v_slot.id, p_id) + p_team_size > v_slot.corporate_capacity then
      raise exception 'The team exceeds the remaining corporate capacity of this time slot.';
    end if;
  end if;
  if p_id is null then
    insert into public.corporate_bookings(company_id,event_id,event_slot_id,team_size,status,contact_name,contact_email,notes,attendance_count,volunteer_hours)
    values(p_company_id,v_slot.event_id,v_slot.id,p_team_size,p_status,p_contact_name,p_contact_email,p_notes,p_attendance_count,p_volunteer_hours)
    returning * into v_result;
  else
    update public.corporate_bookings set company_id=p_company_id,event_id=v_slot.event_id,event_slot_id=v_slot.id,
      team_size=p_team_size,status=p_status,contact_name=p_contact_name,contact_email=p_contact_email,notes=p_notes,
      cancellation_reason = case when p_status = 'Cancelled' then
        case when v_event.status = 'Cancelled' then 'Parent event cancelled' else 'Company/admin cancelled' end
        else null end,
      attendance_count=p_attendance_count,volunteer_hours=p_volunteer_hours where id=p_id returning * into v_result;
  end if;
  return v_result;
end;
$$;

create or replace function public.get_slot_availability()
returns table(event_slot_id bigint, remaining bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, greatest(0::bigint, s.capacity - (select count(*) from public.bookings b where b.event_slot_id=s.id))
  from public.event_slots s where auth.uid() is not null order by s.id;
$$;

create or replace function public.book_event_slot(p_event_slot_id bigint)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_slot public.event_slots%rowtype;
  v_profile public.profiles%rowtype;
  v_event_date date;
  v_event_status text;
  v_booking_count integer;
  v_booking public.bookings%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to book an event.';
  end if;

  select *
  into v_slot
  from public.event_slots
  where id = p_event_slot_id
  for update;

  if not found then
    raise exception 'This event slot no longer exists.';
  end if;

  select e.date::date, e.status
  into v_event_date, v_event_status
  from public.events e
  where e.id = v_slot.event_id;

  if not found then
    raise exception 'This event no longer exists.';
  end if;

  if v_event_status = 'Cancelled' then
    raise exception 'This event has been cancelled and can no longer be booked.';
  end if;

  if v_event_date < (now() at time zone 'Africa/Johannesburg')::date
    or (v_event_date = (now() at time zone 'Africa/Johannesburg')::date
      and v_slot.end_time <= (now() at time zone 'Africa/Johannesburg')::time) then
    raise exception 'This event slot has already ended and cannot be booked.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
    and role = 'volunteer';

  if not found then
    raise exception 'Only volunteer accounts can book event slots.';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.event_id = v_slot.event_id
      and b.user_id = v_user_id
  ) then
    raise exception 'You already have a booking for this event.';
  end if;

  select count(*)
  into v_booking_count
  from public.bookings b
  where b.event_slot_id = v_slot.id;

  if v_booking_count >= v_slot.capacity then
    raise exception 'This time slot is already full.';
  end if;

  insert into public.bookings (
    event_id,
    event_slot_id,
    user_id,
    volunteer_name,
    volunteer_email,
    selected_slot,
    status
  )
  values (
    v_slot.event_id,
    v_slot.id,
    v_user_id,
    v_profile.full_name,
    v_profile.email,
    to_char(v_slot.start_time, 'HH24:MI')
      || '-'
      || to_char(v_slot.end_time, 'HH24:MI'),
    'Confirmed'
  )
  returning * into v_booking;

  return v_booking;
end;
$function$;

create or replace function public.save_event_with_slots(
  p_event_id bigint,
  p_title text,
  p_date date,
  p_location text,
  p_slots jsonb
)
RETURNS events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_event public.events%rowtype;
  v_slot jsonb;
  v_start_time time;
  v_end_time time;
  v_capacity integer;
  v_corporate_capacity integer;
  v_corporate_reserved bigint;
  v_slot_id bigint;
  v_reserved bigint;
  v_seen_ids bigint[] := ARRAY[]::bigint[];
  v_existing_slot public.event_slots%rowtype;
  v_time_slots text;
  v_total_slots integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can manage events.';
  end if;

  if trim(p_title) = ''
    or p_date is null
    or trim(p_location) = '' then
    raise exception 'Title, date, and location are required.';
  end if;

  if jsonb_typeof(p_slots) <> 'array'
    or jsonb_array_length(p_slots) = 0 then
    raise exception 'Add at least one time slot.';
  end if;

  if p_event_id is null then

    insert into public.events (
      title,
      date,
      location,
      time_slots,
      total_slots
    )
    values (
      trim(p_title),
      to_char(p_date, 'YYYY-MM-DD'),
      trim(p_location),
      '',
      0
    )
    returning *
    into v_event;

  else

    select *
    into v_event
    from public.events
    where id = p_event_id
    for update;

    if not found then
      raise exception 'The event no longer exists.';
    end if;

    -- Serialize slot edits with both individual and corporate reservations.
    perform id from public.event_slots where event_id = p_event_id order by id for update;

    -- Metadata and non-invalidating slot edits remain possible after bookings.
    if v_event.date::date is distinct from p_date and (
      exists (select 1 from public.bookings where event_id = p_event_id)
      or exists (select 1 from public.corporate_bookings where event_id = p_event_id)
    ) then
      raise exception 'An event date cannot change after bookings exist.';
    end if;

    update public.events
    set
      title = trim(p_title),
      date = to_char(p_date, 'YYYY-MM-DD'),
      location = trim(p_location)
    where id = p_event_id
    returning *
    into v_event;

  end if;

  for v_slot in
    select value
    from jsonb_array_elements(p_slots)
  loop

    v_start_time :=
      (v_slot ->> 'start_time')::time;

    v_end_time :=
      (v_slot ->> 'end_time')::time;

    v_capacity :=
      (v_slot ->> 'capacity')::integer;

    -- Missing corporate input preserves existing limits, or defaults to zero for new slots.
    v_corporate_capacity := (v_slot ->> 'corporate_capacity')::integer;
    if v_corporate_capacity < 0 then
      raise exception 'Corporate capacity must be a nonnegative integer.';
    end if;

    v_slot_id := nullif(v_slot ->> 'id', '')::bigint;

    if v_end_time <= v_start_time then
      raise exception
        'Each time slot must end after it starts.';
    end if;

    if v_capacity is null
       or v_capacity < 1 then
      raise exception
        'Each time slot must have a capacity of at least one.';
    end if;

    if v_event.id is not null and v_slot_id is not null then
      if v_slot_id = any(v_seen_ids) then
        raise exception 'Each event slot can appear only once.';
      end if;
      v_seen_ids := array_append(v_seen_ids, v_slot_id);
      select * into v_existing_slot
      from public.event_slots
      where id = v_slot_id and event_id = v_event.id
      for update;
      if not found then
        raise exception 'The event slot does not belong to this event.';
      end if;
      select count(*)
      into v_reserved
      from public.bookings
      where event_slot_id = v_slot_id;
      v_corporate_reserved := public.csr_reserved_spaces(v_slot_id);
      v_corporate_capacity := coalesce(v_corporate_capacity, v_existing_slot.corporate_capacity);
      if (v_reserved > 0 or v_corporate_reserved > 0) and (
        v_existing_slot.start_time is distinct from v_start_time
        or v_existing_slot.end_time is distinct from v_end_time
      ) then
        raise exception 'A booked slot cannot change its times.';
      end if;
      if v_capacity < v_reserved then
        raise exception 'Individual capacity cannot be reduced below individual reserved places.';
      end if;
      if v_corporate_capacity < v_corporate_reserved then
        raise exception 'Corporate capacity cannot be reduced below corporate reserved places.';
      end if;
      update public.event_slots
      set start_time = v_start_time, end_time = v_end_time, capacity = v_capacity, corporate_capacity = v_corporate_capacity
      where id = v_slot_id;
    else
      insert into public.event_slots (event_id, start_time, end_time, capacity, corporate_capacity)
      values (v_event.id, v_start_time, v_end_time, v_capacity, coalesce(v_corporate_capacity, 0));
    end if;

  end loop;

  if p_event_id is not null then
    for v_existing_slot in
      select * from public.event_slots
      where event_id = v_event.id
        and not (id = any(v_seen_ids))
      for update
    loop
      if exists (select 1 from public.bookings where event_slot_id = v_existing_slot.id)
        or exists (select 1 from public.corporate_bookings where event_slot_id = v_existing_slot.id) then
        raise exception 'A booked slot cannot be removed.';
      end if;
      delete from public.event_slots where id = v_existing_slot.id;
    end loop;
  end if;

  select
    string_agg(
      to_char(start_time, 'HH24:MI')
      || '-'
      || to_char(end_time, 'HH24:MI'),
      ','
      order by start_time
    ),
    sum(capacity)
  into
    v_time_slots,
    v_total_slots
  from public.event_slots
  where event_id = v_event.id;

  update public.events
  set
    time_slots = v_time_slots,
    total_slots = v_total_slots
  where id = v_event.id
  returning *
  into v_event;

  return v_event;
end;
$function$;

create or replace function public.csr_guard_individual_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_slot public.event_slots%rowtype; v_count bigint;
begin
  if tg_op = 'UPDATE' and new.event_slot_id is not distinct from old.event_slot_id
    and new.event_id is not distinct from old.event_id then return new; end if;
  if new.event_slot_id is null then return new; end if;
  -- Slot locks serialize writers, but cannot refresh a REPEATABLE READ snapshot.
  -- PostgreSQL READ UNCOMMITTED has the same snapshot semantics as READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Capacity mutations require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  select * into v_slot from public.event_slots where id = new.event_slot_id for update;
  if not found or v_slot.event_id is distinct from new.event_id then raise exception 'Booking event and slot must match.'; end if;
  select count(*) into v_count from public.bookings where event_slot_id = v_slot.id and id <> new.id;
  if v_count + 1 > v_slot.capacity then raise exception 'This time slot is already full.'; end if;
  return new;
end;
$$;

create or replace function public.csr_guard_slot_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count bigint;
begin
  -- Slot locks serialize writers, but cannot refresh a REPEATABLE READ snapshot.
  -- PostgreSQL READ UNCOMMITTED has the same snapshot semantics as READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Capacity mutations require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  select count(*) into v_count from public.bookings where event_slot_id = old.id;
  if new.event_id <> old.event_id and (v_count > 0 or exists(select 1 from public.corporate_bookings where event_slot_id = old.id)) then
    raise exception 'A booked slot cannot be moved to another event.';
  end if;
  if new.capacity < v_count then raise exception 'Individual capacity cannot be reduced below individual reserved places.'; end if;
  if new.corporate_capacity < public.csr_reserved_spaces(old.id) then
    raise exception 'Corporate capacity cannot be reduced below corporate reserved places.';
  end if;
  return new;
end;
$$;

-- Replace the existing trigger in place so direct corporate-limit edits are guarded.
create or replace trigger event_slots_shared_capacity
before update of capacity,corporate_capacity,event_id on public.event_slots
for each row execute function public.csr_guard_slot_capacity();

-- CREATE OR REPLACE retains existing grants. Reassert the restricted RPC grants.
revoke all on function public.save_corporate_booking(bigint,bigint,bigint,integer,text,text,text,text,integer,numeric) from public, anon, authenticated;
grant execute on function public.save_corporate_booking(bigint,bigint,bigint,integer,text,text,text,text,integer,numeric) to authenticated;
revoke all on function public.get_slot_availability() from public, anon, authenticated;
grant execute on function public.get_slot_availability() to authenticated;
revoke all on function public.csr_guard_individual_capacity(), public.csr_guard_slot_capacity() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
