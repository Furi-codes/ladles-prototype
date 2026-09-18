-- READ ONLY: run in Supabase SQL Editor and share the JSON result.
-- Reports schema/security configuration only. No volunteer records are returned.
with target_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
    c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'volunteers', 'bookings', 'attendance_records', 'volunteer_totals')
    and c.relkind in ('r', 'p')
)
select jsonb_build_object(
  'tables', coalesce((
    select jsonb_agg(to_jsonb(t) - 'oid' order by t.table_name) from target_tables t
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(to_jsonb(c) order by c.table_name, c.ordinal_position)
    from (
      select table_name, column_name, data_type, is_nullable, column_default, ordinal_position
      from information_schema.columns
      where table_schema = 'public' and table_name in (select t.table_name from target_tables t)
    ) c
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname)
    from pg_policies p
    where p.schemaname = 'public' and p.tablename in (select t.table_name from target_tables t)
  ), '[]'::jsonb),
  'grants', coalesce((
    select jsonb_agg(to_jsonb(g) order by g.table_name, g.grantee, g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name in (select t.table_name from target_tables t)
      and g.grantee in ('anon', 'authenticated', 'PUBLIC')
  ), '[]'::jsonb),
  'column_grants', coalesce((
    select jsonb_agg(to_jsonb(g) order by g.table_name, g.column_name, g.grantee)
    from information_schema.role_column_grants g
    where g.table_schema = 'public' and g.table_name in (select t.table_name from target_tables t)
      and g.grantee in ('anon', 'authenticated', 'PUBLIC')
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table', t.table_name, 'name', tr.tgname,
      'definition', pg_get_triggerdef(tr.oid),
      'function_schema', fn.nspname, 'function_name', f.proname
    ) order by t.table_name, tr.tgname)
    from target_tables t
    join pg_trigger tr on tr.tgrelid = t.oid and not tr.tgisinternal
    join pg_proc f on f.oid = tr.tgfoid
    join pg_namespace fn on fn.oid = f.pronamespace
  ), '[]'::jsonb),
  'realtime_publication', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.tablename)
    from pg_publication_tables p
    where p.pubname = 'supabase_realtime' and p.schemaname = 'public'
  ), '[]'::jsonb)
) as leaderboard_audit;
