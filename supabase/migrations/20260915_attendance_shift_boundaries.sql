-- Attendance may start up to 30 minutes early or at any point before a shift ends.
-- Actual recorded minutes are capped at the scheduled shift end.

begin;

create or replace function public.record_event_attendance(p_checkpoint_id uuid)
returns public.attendance_records
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_action text;
  v_event_status text;
  v_event_date date;
  v_start_time time;
  v_end_time time;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_now timestamptz := now();
  v_booking public.bookings%rowtype;
  v_attendance public.attendance_records%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to record attendance.';
  end if;

  select checkpoint.action into v_action
  from public.event_attendance_checkpoints checkpoint
  where checkpoint.id = p_checkpoint_id and checkpoint.is_active = true;
  if not found then raise exception 'This attendance QR code is not active.'; end if;

  select b.* into v_booking
  from public.bookings b
  join public.event_attendance_checkpoints checkpoint on checkpoint.event_id = b.event_id
  where checkpoint.id = p_checkpoint_id and b.user_id = v_user_id
  for update of b;
  if not found then raise exception 'You do not have a booking for this event.'; end if;

  select e.status, e.date::date, slot.start_time, slot.end_time
  into v_event_status, v_event_date, v_start_time, v_end_time
  from public.events e
  join public.event_slots slot on slot.id = v_booking.event_slot_id
  where e.id = v_booking.event_id;
  if not found then raise exception 'The event or its booked time range no longer exists.'; end if;
  if v_event_status = 'Cancelled' then raise exception 'This event has been cancelled.'; end if;

  v_start_at := (v_event_date + v_start_time) at time zone 'Africa/Johannesburg';
  v_end_at := (v_event_date + v_end_time) at time zone 'Africa/Johannesburg';

  if v_action = 'clock_in' then
    if v_now < v_start_at - interval '30 minutes' or v_now > v_end_at then
      raise exception 'Clock-in is available from 30 minutes before your shift starts until the shift ends.';
    end if;

    select * into v_attendance from public.attendance_records where booking_id = v_booking.id for update;
    if found and v_attendance.clocked_in_at is not null then raise exception 'You have already clocked in.'; end if;

    insert into public.attendance_records (booking_id, clocked_in_at)
    values (v_booking.id, v_now)
    on conflict (booking_id) do update set clocked_in_at = excluded.clocked_in_at
    returning * into v_attendance;
    update public.bookings set status = 'Present' where id = v_booking.id;
    return v_attendance;
  end if;

  if v_now > v_end_at + interval '2 hours' then
    raise exception 'Clock-out is available until two hours after your shift ends.';
  end if;

  select * into v_attendance from public.attendance_records where booking_id = v_booking.id for update;
  if not found or v_attendance.clocked_in_at is null then raise exception 'You must clock in before clocking out.'; end if;
  if v_attendance.clocked_out_at is not null then raise exception 'You have already clocked out.'; end if;

  update public.attendance_records
  set clocked_out_at = v_now,
      worked_minutes = greatest(0, floor(extract(epoch from (least(v_now, v_end_at) - v_attendance.clocked_in_at)) / 60)::integer)
  where id = v_attendance.id
  returning * into v_attendance;
  update public.bookings set status = 'Completed' where id = v_booking.id;
  return v_attendance;
end;
$$;

commit;
