# Reports, dashboard and administrator access handoff

Branch: **AmienBranch**. The existing CSR/Reports/Settings migration is treated as applied and has not been modified or rerun. No migration or data-changing SQL was executed against any database during this task.

**DBA REVIEW REQUIRED — the new migration is NOT APPLIED:** `supabase/migrations/20260918130248_admin_access_fixed_identity_review.sql`. Full SQL is reproduced at the end of this document.

## Files changed

| File | Change |
| --- | --- |
| `app/admin/components/ReportsManager.tsx` | Editable presets, searchable selectors, corporate-only scope and matching CSV |
| `app/admin/components/SearchSelector.tsx` | Small debounced search control using existing styles and native keyboard-accessible inputs/buttons |
| `lib/reporting.ts` | Johannesburg date presets and shared report scope selection; existing formulas preserved |
| `lib/actions/corporate.ts` | Filtered/paginated report queries, bounded event/location search, explicit settings update allowlist, corrected baseline error wording |
| `app/admin/components/FeatureShared.tsx` | Ignore out-of-order load responses when report filters change |
| `app/admin/components/DashboardAnalytics.tsx` | Compact 30-day summary using the existing reporting calculations |
| `app/admin/components/Dashboard.tsx` | Add summary and preserve operational sections |
| `app/admin/components/AdminAccessManager.tsx` | Administrator list, user search, confirmation, grant/revoke and unavailable-state UI |
| `lib/actions/access.ts` | Access RPC calls and specific missing-migration error |
| `app/admin/components/SettingsManager.tsx` | Fixed identity and access manager integration |
| `app/admin/admin.module.css` | Constrain feature grids so report tables scroll within their cards |
| `supabase/migrations/20260918130248_admin_access_fixed_identity_review.sql` | New additive DBA-review migration only |
| `tests/reporting.test.mjs` | Preset and report/CSV scope checks |
| `tests/report-loading.test.mjs` | Search limits, historical search, server filtering and pagination |
| `tests/access-review.test.mjs` | SQL source contracts, RPC action mocks and settings allowlist |
| `docs/ADMIN_REPORTS_ACCESS_HANDOFF.md` | This handoff, verification limitations and full SQL |

No runtime dependencies or lockfile changes were introduced. Temporary verification tools and browser fixtures were kept outside tracked application files.

## Reports UX and presets

Event search initially returns at most eight recent events dated today or earlier. Typing searches titles across all dates, including historical and future events, without the report date filter limiting discovery. The selected event retains its ID and label; selecting an old event does not silently clear the date range. Location search uses literal substring matching, samples at most 50 matching event locations and displays at most eight distinct locations. Refine the query when a common location occupies the sample. Selected locations still use exact location equality in reports.

Search is debounced, stale responses are ignored, and empty/error/loading states are explicit. Controls use existing components/styles; no selector dependency was added. Search terms do not become active filters until a result is selected. Clear removes the active filter.

Report data is fetched for matching events, with related bookings, slots, attendance and corporate records fetched in bounded ID batches with exact-count pagination. A custom unbounded report intentionally loads all matching history. The existing global admin provider still has its pre-existing data-loading behavior; it was not redesigned.

| Preset | Starting date range and scope |
| --- | --- |
| Recent Activity | Last 30 calendar days, including today; individual and corporate |
| Monthly Volunteer Activity | Month to date; individual and corporate |
| Event Attendance | Last 90 calendar days, including today; individual and corporate |
| Volunteer Hours | Month to date; individual and corporate |
| Corporate Participation | Month to date; corporate only |
| Custom Report | No date/event/location/company restrictions; individual and corporate |

Dates use Africa/Johannesburg and refer to event dates. Presets are starting filters, not different metrics. Changes switch the preset label to Custom Report while retaining other active choices. Company selection switches to corporate-only reporting; changing participation back to all clears the company. All applicable date/event/location filters remain editable.

The displayed event-performance rows are the exact rows passed to CSV generation. Corporate-only rows exclude individual bookings/minutes and nonmatching companies; event capacity remains full event-slot capacity. No participating corporate groups means no corporate report row. Empty or invalid ranges disable export. Report summaries are hidden while loading or when no data was successfully loaded, so loading failures are not presented as zero activity.

Preserved calculations: capacity sums `event_slots.capacity`; verified individual hours sum `attendance_records.worked_minutes / 60`; corporate hours use recorded `volunteer_hours` for Completed groups; attendance uses individual clock-ins and completed group attendance. Employee participation counts are instances, never fabricated unique identities. Cancelled corporate bookings/events are excluded from corporate contributions. CSV quoting and formula-injection neutralization remain intact.

## Dashboard

The existing operational overview remains. A separate compact Recent activity card shows recorded attendees, verified individual hours, recorded corporate hours and corporate group counts for the last 30 days. It uses `loadReportData` and `performanceRows`, with loading/error/retry states. **View Full Reports** links to `/admin/reports`; the dedicated page remains the place for filters, presets and CSV.

## Administrator access and security

Settings lists current administrators, searches existing profiles by name/email and offers explicit target confirmation before grant/revoke. The client sends only target ID and requested role to `set_profile_admin_access`; it never updates `profiles.role` directly and uses no service-role credentials.

The new RPC checks:

1. `auth.uid()` is present.
2. The caller passes the existing `public.is_admin()` before locking and again after waiting for the lock.
3. Requested role is exactly `admin` or `volunteer`, including explicit rejection of NULL.
4. The target profile exists.
5. A caller cannot demote themselves.
6. The final remaining administrator cannot be demoted.
7. Access mutations use READ COMMITTED-compatible isolation, and a SHARE ROW EXCLUSIVE profile-table lock serializes changes with other profile writes. This is a short, infrequent operation; staging must assess contention.

The supplied historical profile policy allows admins to update profiles directly. An additional SECURITY INVOKER trigger blocks role changes unless `current_user = 'postgres'`, which is the required owner/execution identity of the SECURITY DEFINER RPC. A browser cannot set `current_user`. This closes direct REST-update bypasses without replacing or broadening any existing RLS policy. Ordinary profile fields, volunteer self-update checks and registration policies remain unchanged. Trusted postgres/DBA operations remain privileged; the trigger is not a boundary against the database owner. DBA review must check other existing SECURITY DEFINER write functions for alternative role-change paths.

`search_admin_access_profiles` is also authenticated/admin-only, exposes only ID/name/email/role, requires two characters, rejects queries over 200 characters and returns at most ten profiles. An empty query checks authorization/availability without returning profiles. Literal substring search avoids dynamic SQL and wildcard interpretation.

Both RPCs set an empty search path, qualify object references and revoke default PUBLIC/anon/authenticated execution before explicitly granting EXECUTE to authenticated. Trigger functions have execution revoked from PUBLIC/anon/authenticated and are invoked only by their triggers. Existing table grants, RLS and `is_admin()` are not modified. No table, function or policy is dropped.

Missing RPC errors produce a message specifically requesting review/application of the **new admin access / fixed identity migration**, not the already-applied CSR migration. Role buttons stay disabled while the access search/availability check fails. There is no fallback to a direct role update.

## Fixed organisation identity

Settings displays a read-only **Ladles of Love** input with no submitted field name. `saveSettings` uses an explicit allowlist excluding organisation_name, even if an extra property is injected by a caller. Default location, contact email, timezone and notification preferences retain their existing save behavior.

The applied settings design grants RLS-protected direct UPDATE, so client changes alone cannot prevent an old client/API caller renaming the organisation. The new migration adds an INSERT/UPDATE trigger rejecting any other identity. It also corrects only the existing singleton name if previously edited, preserving all other settings and retaining the database column. **Database enforcement begins only after DBA application.** Until then this UI is read-only, but the old direct API capability still exists.

## Verification and limitations

- TypeScript: `npx --no-install tsc --noEmit` passed.
- ESLint: `npm run lint` passed with zero errors and zero warnings after temporary fixture cleanup.
- Production: `npm run build` passed, including the final grid overflow fix and loading-state guard; all 15 static pages generated. One final sandbox run hit Windows `spawn EPERM` in the TypeScript worker after successful compilation; the same build was rerun with process-spawn permissions.
- Automated tests: `node --test --experimental-test-isolation=none tests/*.test.mjs` passed **29/29**. Default child-process isolation encountered Windows sandbox `spawn EPERM`; running the same tests without child-process isolation succeeded.
- Automated test coverage includes preserved reporting/capacity/corporate cancellation contracts, all six preset dates, company CSV scope, filtered loading, server pagination, historical search, missing-RPC handling and settings payload protection.
- SQL tests are **source-contract checks only**. They did not execute functions, RLS, locks, triggers or role grants in PostgreSQL.
- Browser validation used the local production build and isolated synthetic REST/auth fixtures; all Supabase requests and realtime sockets in that fixture session were intercepted. No fixture record was inserted into a database.
- The real login page rendered with existing controls. Fixture checks covered recent options, old-event and location search, six presets, combined filters, CSV content/empty state, recorded dashboard values and Reports navigation. Settings fixture checks passed for read-only identity, disabled self-revocation, target confirmation, RPC-based grant/revoke, refreshed administrator list, allowed-field saving, missing-migration messaging and disabled role controls. No browser path sent a profile PATCH for role changes.

Final visual inspection verified the Reports layout at 1262px and 390px widths: document width equals viewport width, and Export CSV remains visible. The browser runtime-error list was empty.

Live schema inspection was authorized, but the configured app project `lkczfrnuksjxsimbcxkz` is not accessible to the connected Supabase account. A read-only catalog request returned “You do not have permission to perform this action.” No live schema result was obtained. Security implementation was reconciled against the earlier user-supplied schema export (profiles schema, `is_admin()`, profile INSERT/SELECT/UPDATE policies) and the applied migration represented in the repository. This is not a claim that the live schema was verified.

## DBA and staging verification still required

1. Compare current profiles schema, constraints/default, triggers, grants, all policies, `is_admin()` and existing SECURITY DEFINER writers against the supplied baseline. Confirm the migration is run as postgres and the new functions are postgres-owned; do not rerun the CSR migration.
2. After DBA review/application in staging, test anonymous/non-admin grant and revoke denial; successful admin grant and revocation of another admin; missing target and invalid/NULL role rejection; self-revocation denial; final-admin protection; and direct REST role-update rejection. Confirm the denied calls leave profiles unchanged.
3. Test concurrent revocations and caller revocation while a second operation waits. Verify fresh authorization after the lock, a surviving admin, and expected rejection under REPEATABLE READ. Assess lock contention with normal profile edits.
4. Verify volunteer profile self-updates remain allowed only within existing protections; volunteer registration still inserts role volunteer; volunteers cannot promote themselves; admin account-name changes work. Check trusted backend/service-role writers for compatibility with the new role-change trigger.
5. Verify settings writes can change allowed fields but cannot change the fixed identity through direct API or any existing RPC. Verify identity normalization is appropriate if the stored name differs.
6. Verify function execution grants, safe search paths and API schema reload. Check missing-RPC handling before deployment and functional buttons after deployment.
7. Reconcile reports against real attendance/corporate data, validate timezone boundaries and older events/locations, inspect export content, and test large data beyond API row caps.
8. Run authenticated end-to-end regressions for registration/login, admin guards, events and slot editing, individual/corporate reservations and shared capacity, attendance, notifications, CSR, Reports and Settings. Existing implementation paths and historical migration were preserved; live booking/auth/RLS regressions were not executed here.

## Full new migration SQL

```sql
-- DBA REVIEW REQUIRED - NOT APPLIED. Run as postgres after reviewing live schema.
-- Baseline: the CSR/Reports/Settings migration has already been applied.
-- No existing policy, is_admin(), table, or historical migration is replaced.
begin;

-- The invoker trigger below trusts only the postgres-owned SECURITY DEFINER RPC.
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'DBA must review and run this migration as postgres.';
  end if;
end; $$;

-- Existing profiles_update_admin permits direct role updates. Close that bypass
-- without changing RLS or blocking normal profile/account edits. This is INVOKER:
-- inside the RPC current_user is postgres; a browser cannot choose current_user.
create function public.guard_profile_role_changes() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.role is distinct from old.role and current_user <> 'postgres' then
    raise exception 'Use the administrator access RPC to change roles.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_role_changes() from public, anon, authenticated;
create trigger profiles_guard_role_changes before update on public.profiles
for each row execute function public.guard_profile_role_changes();

create function public.set_profile_admin_access(p_target_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := auth.uid();
  v_old_role text;
begin
  if v_caller is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.is_admin() then
    raise exception 'Only administrators can manage access.' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'volunteer') then
    raise exception 'Role must be admin or volunteer.' using errcode = '22023';
  end if;
  -- Fresh snapshots after waiting are required for authorization and final-admin checks.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Access changes require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  -- Infrequent access changes serialize with all profile writes, including deletion.
  -- This prevents two concurrent revocations from using the same administrator count.
  lock table public.profiles in share row exclusive mode;
  if not public.is_admin() then
    raise exception 'Administrator access has changed. Sign in again.' using errcode = '42501';
  end if;
  select role into v_old_role from public.profiles where id = p_target_id;
  if not found then
    raise exception 'Target profile does not exist.' using errcode = 'P0002';
  end if;
  if p_target_id = v_caller and p_role = 'volunteer' then
    raise exception 'You cannot revoke your own administrator access.' using errcode = '42501';
  end if;
  if v_old_role = 'admin' and p_role = 'volunteer'
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'The final administrator cannot be removed.' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_target_id;
end;
$$;
revoke all on function public.set_profile_admin_access(uuid,text) from public, anon, authenticated;
grant execute on function public.set_profile_admin_access(uuid,text) to authenticated;

-- Bounded, literal substring search; no wildcard/filter-string interpolation.
-- Empty query checks availability/authorization without returning profile data.
create function public.search_admin_access_profiles(p_query text default '')
returns table(id uuid, full_name text, email text, role text)
language plpgsql security definer set search_path = '' as $$
declare v_query text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, '')));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can search access profiles.' using errcode = '42501';
  end if;
  if pg_catalog.length(v_query) < 2 then return; end if;
  if pg_catalog.length(v_query) > 200 then
    raise exception 'Search must be at most 200 characters.' using errcode = '22023';
  end if;
  return query select p.id, p.full_name, p.email, p.role
    from public.profiles p
    where pg_catalog.strpos(pg_catalog.lower(p.full_name), v_query) > 0
       or pg_catalog.strpos(pg_catalog.lower(coalesce(p.email, '')), v_query) > 0
    order by p.full_name, p.id limit 10;
end;
$$;
revoke all on function public.search_admin_access_profiles(text) from public, anon, authenticated;
grant execute on function public.search_admin_access_profiles(text) to authenticated;

-- Settings uses direct RLS-protected UPDATE, not an RPC. Enforce identity on
-- every write so old clients cannot rename it. Preserve all other settings.
create function public.guard_organisation_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.organisation_name is distinct from 'Ladles of Love' then
    raise exception 'Organisation name is fixed as Ladles of Love.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_organisation_identity() from public, anon, authenticated;
-- Correct only the singleton identity if a previous admin edited it.
update public.organisation_settings set organisation_name = 'Ladles of Love'
where id = 1 and organisation_name is distinct from 'Ladles of Love';
create trigger organisation_settings_fixed_identity before insert or update on public.organisation_settings
for each row execute function public.guard_organisation_identity();

notify pgrst, 'reload schema';
commit;
```
