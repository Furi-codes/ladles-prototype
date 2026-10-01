-- Manual attendance codes. Additive: the existing QR function is unchanged.
begin;
create schema if not exists attendance_private;
revoke all on schema attendance_private from public, anon;
grant usage on schema attendance_private to authenticated;

alter table public.event_attendance_checkpoints
  add column if not exists entry_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
create unique index if not exists attendance_checkpoint_entry_code_key
  on public.event_attendance_checkpoints(entry_code);

create table if not exists attendance_private.code_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null
);
alter table attendance_private.code_attempts enable row level security;
revoke all on attendance_private.code_attempts from public, anon, authenticated;

create or replace function attendance_private.record_code(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_checkpoint uuid;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'));
  v_attempts integer;
  v_record public.attendance_records;
begin
  if v_user is null then return jsonb_build_object('error', 'Please sign in to record attendance.'); end if;
  -- Atomic per-user counter. Return errors instead of raising so attempts persist.
  insert into attendance_private.code_attempts as a (user_id, window_started_at, attempts)
    values (v_user, clock_timestamp(), 1)
    on conflict (user_id) do update set
      attempts = case when a.window_started_at <= clock_timestamp() - interval '10 minutes' then 1 else least(a.attempts + 1, 11) end,
      window_started_at = case when a.window_started_at <= clock_timestamp() - interval '10 minutes' then clock_timestamp() else a.window_started_at end
    returning attempts into v_attempts;
  if v_attempts > 10 then return jsonb_build_object('error', 'Too many code attempts. Please wait 10 minutes before trying again.'); end if;
  if v_code !~ '^[0-9A-F]{10}$' then return jsonb_build_object('error', 'Enter the 10-character code shown by the event organiser.'); end if;
  select c.id into v_checkpoint from public.event_attendance_checkpoints c
    where c.entry_code = v_code and c.is_active;
  if not found then return jsonb_build_object('error', 'This attendance code is invalid or no longer active.'); end if;
  -- Keep the existing booking lock, time windows, duplicate checks and WMS triggers.
  begin
    v_record := public.record_event_attendance(v_checkpoint);
  exception when others then
    return jsonb_build_object('error', SQLERRM);
  end;
  return jsonb_build_object('attendance', to_jsonb(v_record));
end;
$function$;
revoke all on function attendance_private.record_code(text) from public, anon;
grant execute on function attendance_private.record_code(text) to authenticated;

create or replace function public.record_event_attendance_code(p_code text)
returns jsonb language sql security invoker set search_path = ''
as $function$ select attendance_private.record_code(p_code); $function$;
revoke all on function public.record_event_attendance_code(text) from public, anon;
grant execute on function public.record_event_attendance_code(text) to authenticated;

create or replace function attendance_private.rotate_code(p_checkpoint_id uuid)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_code text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required.'; end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      update public.event_attendance_checkpoints set entry_code = v_code
        where id = p_checkpoint_id and is_active;
      if not found then raise exception 'Active checkpoint not found.'; end if;
      return v_code;
    exception when unique_violation then
      -- Generate another code in the unlikely event of a collision.
    end;
  end loop;
end;
$function$;
revoke all on function attendance_private.rotate_code(uuid) from public, anon;
grant execute on function attendance_private.rotate_code(uuid) to authenticated;
create or replace function public.rotate_attendance_entry_code(p_checkpoint_id uuid)
returns text language sql security invoker set search_path = ''
as $function$ select attendance_private.rotate_code(p_checkpoint_id); $function$;
revoke all on function public.rotate_attendance_entry_code(uuid) from public, anon;
grant execute on function public.rotate_attendance_entry_code(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
