-- Saves reporting metadata through an admin-only function.
-- Direct client updates can be accepted by RLS with zero changed rows, which
-- previously allowed a template event to remain in the default Other category.

begin;

create or replace function public.save_event_metadata(
  p_event_id bigint,
  p_category text,
  p_location_url text,
  p_description text
)
returns public.events
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can update event details.';
  end if;

  if p_category not in (
    'Dignity Kitchen',
    'Warehouse HQ',
    'Feed The Soil',
    'Campaign / Special Event',
    'Other'
  ) then
    raise exception 'Invalid event category.';
  end if;

  update public.events
  set
    category = p_category,
    location_url = nullif(trim(p_location_url), ''),
    description = nullif(trim(p_description), '')
  where id = p_event_id
  returning * into v_event;

  if not found then
    raise exception 'This event no longer exists.';
  end if;

  return v_event;
end;
$$;

revoke all on function public.save_event_metadata(bigint, text, text, text) from public;
grant execute on function public.save_event_metadata(bigint, text, text, text) to authenticated;

-- Repair events created from the affected locked templates before metadata had
-- a privileged save path.
update public.events
set category = 'Dignity Kitchen'
where category = 'Other'
  and location = 'Dignity Kitchen'
  and title ilike 'Dignity Kitchen%';

update public.events
set category = 'Warehouse HQ'
where category = 'Other'
  and location = 'Ladles of Love Warehouse HQ'
  and title ilike 'Warehouse%';

commit;
