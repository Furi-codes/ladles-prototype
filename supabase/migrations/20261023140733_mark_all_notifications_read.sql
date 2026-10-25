-- Adds a bulk read operation for the signed-in corporate/admin notification audience.
-- Read markers are inserted in one operation, preserving the notifications themselves as
-- history.

begin;

-- Read receipts belong to one person. Do not update/delete the shared notices,
-- and do not accept a caller-supplied user or company ID.
create function corporate_private.read_all_notices() returns integer
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v_count integer;
begin
  insert into public.corporate_account_notification_reads(notification_id,user_id)
    select n.id,v_user from public.corporate_account_notifications n
    where ((n.audience='admin' and public.is_admin()) or
      (n.audience='corporate' and exists(select 1 from public.corporate_accounts a where a.id=n.account_id and a.owner_user_id=v_user)))
      and not exists(select 1 from public.corporate_account_notification_reads r where r.notification_id=n.id and r.user_id=v_user)
    on conflict do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end $$;

-- The exposed wrapper keeps the same checked-private-function pattern as the
-- existing single-notification action. Anonymous callers have no execute grant.
-- Public invoker wrappers expose the RPC names used by the app. The private
-- implementation performs the operation-specific identity and permission checks.
create function public.corporate_read_all_notices() returns integer
language sql security invoker set search_path='' as $$select corporate_private.read_all_notices()$$;
revoke all on function corporate_private.read_all_notices(),public.corporate_read_all_notices() from public,anon,authenticated;
grant execute on function corporate_private.read_all_notices(),public.corporate_read_all_notices() to authenticated;
notify pgrst,'reload schema';
commit;
