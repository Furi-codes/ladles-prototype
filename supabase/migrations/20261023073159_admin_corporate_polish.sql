-- Updates admin corporate notices, reports and related booking workflow details.
-- These replacements extend earlier functions while retaining the existing records and
-- permission checks.

-- Admin inbox and event-change safeguards. Keep all historical CSR and volunteer records.
begin;

create index corporate_admin_notice_order_idx on public.corporate_account_notifications(created_at desc,id desc) where audience='admin';
-- Return combined admin account/booking notices and the unread total for the current
-- administrator.
create function corporate_private.admin_notices(p_kind text,p_unread boolean,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('','account','booking') or p_unread is null or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Choose valid notification filters and page.' using errcode='22023';
  end if;
  -- One snapshot supplies filtered pages and the global, per-administrator unread total.
  with notices as (
    select n.id,n.account_id,n.title,n.message,n.created_at,n.target_kind,
      case when n.target_kind='account' then n.account_id else n.target_id end target_id,
      a.company_name,
      exists(select 1 from public.corporate_account_notification_reads r where r.notification_id=n.id and r.user_id=v_user) is_read
    from public.corporate_account_notifications n join public.corporate_accounts a on a.id=n.account_id where n.audience='admin'
  ), matched as(select * from notices where (p_kind='' or target_kind=p_kind) and (not p_unread or not is_read)),
  paged as(select * from matched order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by created_at desc,id desc) from paged p),'[]'::jsonb),
    'total',(select count(*) from matched),'unread_total',(select count(*) from notices where not is_read)) into result;
  return result;
end $$;

-- Save an event using the expected version or creation key, and notify affected bookings where
-- required.
create or replace function corporate_private.save_event(p_event_id uuid,p_version integer,p_details jsonb,p_creation_key uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); v jsonb:=corporate_private.clean_event(p_details); e public.corporate_events; v_before jsonb; b public.corporate_reservations;
begin
  perform corporate_private.lock_workflow();
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))>800 then raise exception 'Keep the change message within 800 characters.' using errcode='22023'; end if;
  if p_event_id is not null and length(btrim(coalesce(p_reason,'')))=0 and exists(
    select 1 from public.corporate_reservations r where r.status in ('Requested','Pending payment','Pending additional payment','Confirmed') and
      (r.event_id=p_event_id or exists(select 1 from public.corporate_booking_changes c where c.booking_id=r.id and c.target_event_id=p_event_id and c.status='Requested'))
  ) then raise exception 'Explain this event change to the affected companies before saving. Refresh to see any new requests.' using errcode='22023'; end if;
  p_reason:=coalesce(nullif(btrim(p_reason),''),case when p_event_id is null then 'Corporate session created.' else 'Corporate session updated; no open bookings affected.' end);
  if p_event_id is null then
    if p_creation_key is null then raise exception 'An event creation key is required.' using errcode='22023'; end if;
    -- Serialise identical create intents without locking any volunteer or company records.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_creation_key::text,0));
    select * into e from public.corporate_events where creation_key=p_creation_key;
    if found then
      if e.creation_payload<>v then raise exception 'Creation key was already used for different details.' using errcode='23505'; end if;
      return corporate_private.event_json(e);
    end if;
  else
    select * into e from public.corporate_events where id=p_event_id for update;
    if not found or p_version is distinct from e.version then raise exception 'Event changed. Refresh before saving.' using errcode='40001'; end if;
    if e.starts_at<=clock_timestamp() then raise exception 'An event that has started cannot be moved or rewritten.' using errcode='23514'; end if;
    v_before:=to_jsonb(e);
  end if;
  if (v->>'starts_at')::timestamptz<=clock_timestamp() then raise exception 'Choose a future event start.' using errcode='23514'; end if;
  if p_event_id is null then
    insert into public.corporate_events(title,description,location,starts_at,ends_at,capacity,min_group_size,max_group_size,is_published,creation_key,creation_payload,created_by)
      values(v->>'title',v->>'description',v->>'location',(v->>'starts_at')::timestamptz,(v->>'ends_at')::timestamptz,(v->>'capacity')::integer,(v->>'min_group_size')::integer,(v->>'max_group_size')::integer,(v->>'is_published')::boolean,p_creation_key,v,v_user) returning * into e;
  else
    if (v->>'capacity')::integer<e.reserved_places or exists(select 1 from public.corporate_reservations r where r.event_id=e.id and r.status in ('Pending payment','Pending additional payment','Confirmed','Completed') and
      (r.group_size<(v->>'min_group_size')::integer or r.group_size>(v->>'max_group_size')::integer or
      (r.status in ('Pending payment','Pending additional payment') and r.payment_due_at>=(v->>'starts_at')::timestamptz))) then
      raise exception 'Event changes conflict with accepted groups or payment deadlines. Resolve those bookings first.' using errcode='23514';
    end if;
    update public.corporate_events set title=v->>'title',description=v->>'description',location=v->>'location',starts_at=(v->>'starts_at')::timestamptz,ends_at=(v->>'ends_at')::timestamptz,
      capacity=(v->>'capacity')::integer,min_group_size=(v->>'min_group_size')::integer,max_group_size=(v->>'max_group_size')::integer,is_published=(v->>'is_published')::boolean,version=version+1,updated_at=now() where id=e.id returning * into e;
    for b in update public.corporate_reservations set version=version+1,updated_at=now() where event_id=e.id and status in ('Requested','Pending payment','Pending additional payment','Confirmed') returning * loop
      perform corporate_private.write_workflow_action(b,v_user,'Corporate event updated',jsonb_build_object('event',v_before),btrim(p_reason),'corporate');
    end loop;
    -- Proposed destinations do not hold places, but the company still needs to hear if that
    -- destination changes. Keep its submitted proposal unchanged for review/history.
    for b in update public.corporate_reservations set version=version+1,updated_at=now() where event_id<>e.id and id in
      (select booking_id from public.corporate_booking_changes where target_event_id=e.id and status='Requested') returning * loop
      perform corporate_private.write_workflow_action(b,v_user,'Proposed corporate event updated',jsonb_build_object('event',v_before),btrim(p_reason)||' Original booking retained. Proposed event changed; admin must decline the stale proposal before a fresh request.','corporate');
    end loop;
  end if;
  insert into public.corporate_workflow_history(event_id,actor_user_id,actor_name,action,before_values,after_values,reason)
    values(e.id,v_user,coalesce((select full_name from public.profiles where id=v_user),'Administrator'),case when p_event_id is null then 'Corporate event created' else 'Corporate event edited' end,v_before,to_jsonb(e),btrim(p_reason));
  return corporate_private.event_json(e);
end $$;

-- Public invoker wrappers expose the RPC names used by the app. The private
-- implementation performs the operation-specific identity and permission checks.
create function public.corporate_admin_notices(p_kind text default '',p_unread boolean default false,p_offset integer default 0,p_limit integer default 10)
returns jsonb language sql security invoker set search_path='' as $$ select corporate_private.admin_notices(p_kind,p_unread,p_offset,p_limit) $$;
revoke all on function corporate_private.admin_notices(text,boolean,integer,integer),public.corporate_admin_notices(text,boolean,integer,integer) from public,anon,authenticated;
grant execute on function corporate_private.admin_notices(text,boolean,integer,integer),public.corporate_admin_notices(text,boolean,integer,integer) to authenticated;

-- A draft with no requests does not need a made-up change explanation. For an event
-- with live requests/reservations or proposed transfers, a human message is required.
-- Counts are admin-only; no competing company identities are exposed to businesses.
create or replace function corporate_private.event_json(e public.corporate_events) returns jsonb language sql stable set search_path='' as $$
  select(to_jsonb(e)-'creation_key'-'creation_payload')||jsonb_build_object(
    'remaining',case when e.reserved_places>0 then 0 else e.max_group_size end,
    'state',case when e.cancelled_at is not null then 'Cancelled' when e.starts_at<=now() then 'Started'
      when e.reserved_places>0 then 'Reserved' when not e.is_published then 'Closed' else 'Available' end)
    ||case when public.is_admin() then jsonb_build_object('affected_bookings',(select count(*) from public.corporate_reservations b
      where b.status in ('Requested','Pending payment','Pending additional payment','Confirmed') and
        (b.event_id=e.id or exists(select 1 from public.corporate_booking_changes c where c.booking_id=b.id and c.target_event_id=e.id and c.status='Requested')))) else '{}'::jsonb end
$$;

-- Search volunteer profiles for administrators, including people without bookings.
create or replace function corporate_private.volunteer_directory(p_query text,p_phone_filter text,p_offset integer,p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=corporate_private.require_user(); result jsonb; v_query text:=btrim(coalesce(p_query,''));
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_offset is null or p_limit is null or p_phone_filter is null or p_offset<0 or p_limit not between 1 and 100 or length(v_query)>180 or p_phone_filter not in ('','missing','provided') then raise exception 'Invalid directory search.' using errcode='22023'; end if;
  with matched as (
    select p.id,p.full_name,p.email,p.phone,p.date_of_birth,(select count(*) from public.bookings b where b.user_id=p.id) booking_count
    from public.profiles p where p.role='volunteer' and p.volunteer_enabled and
      (position(lower(v_query) in lower(concat_ws(' ',p.full_name,p.email,p.phone)))>0 or
       v_query~'^[+0-9(). -]+$' and v_query~'[0-9]' and position(regexp_replace(v_query,'[^0-9]','','g') in regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'))>0) and
      (p_phone_filter='' or p_phone_filter='missing' and nullif(btrim(p.phone),'') is null or p_phone_filter='provided' and nullif(btrim(p.phone),'') is not null)
  ), paged as(select * from matched order by full_name,id limit p_limit offset p_offset)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by full_name,id) from paged p),'[]'::jsonb),'total',(select count(*) from matched)) into result;
  return result;
end $$;
notify pgrst,'reload schema';
commit;
