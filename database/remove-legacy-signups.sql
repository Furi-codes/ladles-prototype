begin;
-- Refuse to remove any data that appeared after the preflight check.
lock table public.signups in access exclusive mode;
do $check$
begin
  if exists (select 1 from public.signups) then
    raise exception 'signups is not empty; back up its data before removal.';
  end if;
end;
$check$;
-- Do not cascade into other database objects.
drop table public.signups restrict;
notify pgrst, 'reload schema';
commit;
