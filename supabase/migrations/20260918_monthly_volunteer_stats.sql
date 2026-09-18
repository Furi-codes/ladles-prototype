-- Run once in the Supabase SQL Editor. No existing data is changed.
-- Join date means account registration, not first booking or profile update.
begin;

create or replace function public.get_monthly_volunteer_stats()
returns table (month_start date, joined_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := date_trunc('month', now() at time zone 'Africa/Johannesburg')::date;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Only administrators can view volunteer statistics.'
      using errcode = '42501';
  end if;

  return query
  select v_month_start, count(*)
  from public.profiles as profile
  join auth.users as account on account.id = profile.id
  where profile.role = 'volunteer'
    and account.created_at >= (v_month_start::timestamp at time zone 'Africa/Johannesburg')
    and account.created_at < ((v_month_start + interval '1 month') at time zone 'Africa/Johannesburg')
    and account.created_at <= now();
end;
$function$;

revoke all on function public.get_monthly_volunteer_stats() from public, anon;
grant execute on function public.get_monthly_volunteer_stats() to authenticated;

commit;
