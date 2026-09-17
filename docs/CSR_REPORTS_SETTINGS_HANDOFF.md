# Corporate CSR, Reports and Settings — DBA handoff

**REQUIRES DATABASE ADMIN REVIEW — NOT YET APPLIED**

Migration: `supabase/migrations/20260916190557_csr_reports_settings_review.sql`.
The complete SQL appears below and is also available in that standalone file. No migration or schema-changing SQL was executed against Supabase. No production booking, settings, profile or notification was changed during verification.

## Repository reconciliation

Implementation is based on branch `Furi-branch-Part-2`, commit `2456c9cce1b68e759fc4cbc834a2d675d8e27716`. `git ls-remote` confirmed the GitHub branch has that same commit. No remote branch was switched, merged or pushed.

The supplied live schema, functions and RLS are authoritative. Existing application actions call the documented RPCs and use bigint event/slot identifiers as JavaScript numbers, matching existing conventions. Individual cancellation still deletes the row; individual statuses and uniqueness protections are unchanged. The legacy `signups` table is not used.

Two discrepancies remain deliberately untouched:

- `save_event_metadata` and the repository use `events.description`, but the supplied events DDL omits that column. The DBA must confirm the actual column before validating existing event metadata flows. This migration neither adds nor removes it.
- The exported `profiles.role` default appears to contain literal quotes. The application explicitly inserts `role: 'volunteer'`; no default or role policy was changed. The DBA should inspect the live default separately.

The pre-existing Settings whitespace edit was retained when replacing its placeholder content.

## Files created

- `app/admin/components/CorporateBookingForm.tsx`
- `app/admin/components/CorporateManager.tsx`
- `app/admin/components/FeatureShared.tsx`
- `app/admin/components/ReportsManager.tsx`
- `app/admin/components/SettingsManager.tsx`
- `lib/actions/corporate.ts`
- `lib/reporting.ts`
- `supabase/migrations/20260916190557_csr_reports_settings_review.sql`
- `tests/data-pagination.test.mjs`
- `tests/migration.test.mjs`
- `tests/reporting.test.mjs`
- `docs/CSR_REPORTS_SETTINGS_HANDOFF.md` (this document)
- `docs/CSR_STAGING_CHECKLIST.md`

Temporary synthetic browser fixtures and the initial isolated parser package were created under ignored `.exports/` and removed after verification; the final review parser was installed temporarily outside the repository; they were never application code or production data. No application dependencies were added.

## Files modified

- `app/admin/admin.module.css`: small feature spacing helpers using existing cards/forms/breakpoints; existing colours/fonts unchanged.
- `app/admin/csr/page.tsx`: replace placeholder with Corporate CSR.
- `app/admin/reports/page.tsx`: replace placeholder with Reports & Analytics.
- `app/admin/settings/page.tsx`: replace placeholder with Settings.
- `app/volunteer/components/EventModal.tsx`: display aggregate availability, or explicitly say it is checked when booking.
- `lib/actions/volunteer.ts`: merge privacy-safe availability into slot responses; failure does not break existing booking.
- `lib/types.ts`: corporate/settings/availability types and optional slot remaining count.

## Tables and access

| Table | Purpose | Authenticated access |
| --- | --- | --- |
| `corporate_companies` | Manually entered relationships, contacts and CSR estimates | Admin SELECT, INSERT, UPDATE |
| `corporate_bookings` | Slot-bound group reservations and aggregate attendance | Admin SELECT; writes only through RPC |
| `corporate_notes` | Append-only relationship history | Admin SELECT, INSERT; creator must be current user |
| `organisation_settings` | Singleton row with `id = 1` | Admin SELECT, UPDATE |

RLS is enabled on all four tables. Every new policy uses the existing `public.is_admin()`; notes INSERT also checks `created_by = auth.uid()`. No existing policy is replaced or weakened. No corporate table grants volunteer access, no corporate DELETE is granted, and there is no corporate booking INSERT/UPDATE policy. All client/default grants on the three new identity sequences are explicitly revoked first; the only restored authenticated sequence grants are USAGE on the company/note sequences. Sensitive CSR data never appears in volunteer availability responses.

Exact policy names: `corporate_companies_admin_select`, `corporate_companies_admin_insert`, `corporate_companies_admin_update`, `corporate_bookings_admin_select`, `corporate_notes_admin_select`, `corporate_notes_admin_insert`, `organisation_settings_admin_select`, `organisation_settings_admin_update`.

## Functions introduced

| Function | Purpose |
| --- | --- |
| `save_corporate_booking(bigint,bigint,bigint,integer,text,text,text,text,integer,numeric)` | Admin-only create/update/cancel/reactivate/resize/move/attendance RPC |
| `get_slot_availability()` | Authenticated aggregate remaining places; no names or separate corporate totals |
| `csr_reserved_spaces(bigint,bigint default null)` | Internal sum of non-cancelled corporate places, optionally excluding edited row |
| `csr_touch_updated_at()` | Timestamp trigger for company, booking and settings updates |
| `csr_guard_individual_capacity()` | Prevent existing direct admin booking writes from bypassing capacity |
| `csr_guard_slot_capacity()` | Prevent direct slot shrinkage below reservations or moving a booked slot between events |

New definer functions have an empty search path and qualified references. PUBLIC/anon EXECUTE is revoked; only the two intended RPCs receive authenticated EXECUTE. Internal helper/trigger functions are not public RPC capabilities. Database owner/service-role access remains trusted; these roles must not be exposed to clients.

Triggers introduced: `corporate_companies_updated`, `corporate_bookings_updated`, `organisation_settings_updated`, `bookings_shared_capacity`, `event_slots_shared_capacity`.

## Exact existing function changes

Only `book_event_slot(bigint)` and `save_event_with_slots(bigint,text,date,text,jsonb)` are replaced. Their definitions were programmatically compared to the supplied text, confirming these are the only changes:

```diff
-  if v_booking_count >= v_slot.capacity then
+  if v_booking_count + public.csr_reserved_spaces(v_slot.id) >= v_slot.capacity then
```

All authentication, volunteer-role validation, row locking, slot/event checks, cancelled/past date checks, uniqueness checks, insert values, return type and existing error strings remain intact.

```diff
       where event_id = p_event_id
         and event_slot_id is not null
-    ) then
+    ) or exists (
+      select 1 from public.corporate_bookings where event_id = p_event_id
+    ) then
       raise exception
-        'Slots cannot be changed after volunteers have booked this event.';
+        'Slots cannot be changed after individual or corporate bookings exist for this event.';
```

All corporate records, including Cancelled, prevent replacing slots because their foreign keys preserve history. Existing event creation, slot validation, compatibility `time_slots`, and `total_slots = sum(capacity)` behaviour remain intact. `cancel_event`, attendance/no-show functions, `is_admin`, profile/consent functions and authentication are not modified.

The two additional capacity triggers close bypasses allowed by the supplied existing admin INSERT/UPDATE policies; they do not alter role policies. Status-only individual attendance updates and legacy NULL-slot records retain existing behaviour.

## Capacity and concurrency

| Corporate status | Reserves capacity | Attendance fields |
| --- | --- | --- |
| Pending | Full `team_size` | Both NULL |
| Confirmed | Full `team_size` | Both NULL |
| Completed | Full `team_size`, retained as history | Count and hours required |
| Cancelled | Zero | Both NULL |

The corporate RPC locks an existing corporate row on update, then locks old/target slot rows in ascending id order using `FOR UPDATE`. It explicitly selects the target slot `FOR UPDATE`, derives the event from that slot, and computes `COUNT(individual bookings) + SUM(non-cancelled corporate team_size excluding self) + requested team_size <= event_slots.capacity`. The individual RPC locks the same slot before counting. Writes occur while the lock is held until transaction end. Simultaneous requests for the same slot therefore serialize under the required READ COMMITTED isolation model (also accepting PostgreSQL READ UNCOMMITTED, which has identical snapshot semantics). The three new mutation routines enforce this precondition. Database rejection, not the displayed remaining count, is authoritative.

Moving groups locks both slots in deterministic order; cancelling also obtains the slot lock and releases capacity after commit. Direct corporate booking writes by authenticated clients are denied. Direct admin individual INSERT/slot reassignment is guarded by a trigger using the same slot lock and aggregate. A capacity reduction already owns the slot row lock and is rejected if reservations would exceed it. Cancellation of an individual still uses DELETE and can conservatively free capacity after a concurrent check; it cannot cause overbooking.

Completed is allowed only after the shift ends in Africa/Johannesburg and only for a non-cancelled event. Completed reservation identity, company, slot and team size are immutable through the RPC; attendance/contact corrections remain possible. Retaining completed reservations mirrors the historical individual row model and does not open extra places in a shift. A normal future reservation cannot be marked Completed to distort availability.

Constraints require integer team size > 0; completed attendance count between 0 and team size; finite nonnegative hours; zero attendance implies zero hours; both attendance values explicitly NOT NULL on completion and explicitly NULL otherwise. Numeric NaN is rejected. New records must be Pending/Confirmed. Same-day bookings follow the supplied individual RPC's date-based cutoff (`current_date`), not a newly invented end-time rule.

Deadlocks involving the pre-existing event-edit lock order or direct multi-row admin operations remain possible; PostgreSQL aborts one transaction rather than committing an overbooking. UI displays the failure and permits retry. This migration does not redesign event cancellation locking. The pre-existing simultaneous event-cancellation/booking race should be reviewed separately; capacity serialization is not a claim of event lifecycle serialization.

## Reports and CSV

Date filters use inclusive event dates (stored ISO text), not booking creation dates. Location and Event filters combine with both dates. All Locations/All Events are unfiltered values. Invalid date ranges show a validation error and disable export. Events with no bookings can still produce meaningful report rows; a report with no event rows cannot be exported.

| Metric | Formula/data source |
| --- | --- |
| Event capacity | SUM `event_slots.capacity`, never `events.total_slots` |
| Reserved volunteer places | COUNT all individual `bookings` + SUM non-cancelled corporate `team_size` |
| Verified individual hours | SUM `attendance_records.worked_minutes` / 60; NULL contributes zero, no schedule estimate |
| Recorded corporate hours | SUM Completed corporate `volunteer_hours` |
| Recorded attendance | Count individual attendance records with `clocked_in_at` + Completed corporate `attendance_count` |
| Attendance rate | Recorded attendance / reserved places × 100; no denominator means unavailable, shown as — |
| Total events | Number of filtered events |
| Confirmed booking records | Individual Confirmed rows + corporate Confirmed rows; groups count once here |
| Corporate groups | Number of non-cancelled corporate booking records |
| Corporate employee places | SUM non-cancelled selected-company team sizes; participation instances, not unique employees |
| Corporate events supported | Distinct event ids among selected non-cancelled corporate bookings |
| Corporate attendance/hours | Completed selected-company totals |

Reports include cancelled events as history and pending/future reservations in the selected period. Consequently the attendance rate is a recorded-to-reserved rate, not an attendance forecast or a finalized-only rate. The UI explicitly labels this. Individual and corporate hours remain separate because they have different provenance. No individual unique-person count is fabricated from anonymous group headcounts. No meals, beneficiaries, monetary impact or conversion factors are invented.

The report layer explicitly paginates source-table reads in batches of 500 rather than accepting Supabase's default first page. These reads are not a point-in-time transaction; refresh after simultaneous operational changes. Large datasets may eventually merit a paginated database reporting RPC. Exact response counts and actual received page lengths prevent silently truncating data even if the server caps a page below 500 rows. An unavailable count or unexpectedly empty intermediate page is reported as an error.

CSV is a browser-generated UTF-8 BOM file with CRLF rows, quoted fields, escaped quotes, and neutralization of formula-like text including leading whitespace. It exports the currently filtered **event performance report**, with separate individual/corporate hours and rates formatted to two decimal places. Company selection filters the separate corporate impact panel, not the event CSV. No heavy export library was added.

## Settings and UI behaviour

Organisation name, default location, contact email and four notification preferences persist to the singleton row. Timezone is intentionally restricted to Africa/Johannesburg to match existing attendance logic. Defaults do not rewrite existing events or change existing notification behaviour. Notification switches store future preferences only; there is no email/message delivery integration. Admins are listed from `profiles.role = 'admin'`. Account name updates the current profile via the existing authenticated client; email is read-only and password reset uses the existing sign-in flow. No role assignment or Auth administration is exposed.

CSR supports company create/edit/search, relationship/potential tracking, a nullable count of other charities supported, manually entered CSR data, append-only notes, group booking management, cancellation, attendance completion/correction and company/date impact reporting. Estimated annual CSR is labelled ZAR as an explicit display assumption. Original PageHeader, CSS modules, cards, tables, form styles, status badges, colours, fonts, navigation and breakpoints are reused. Inline editors avoid introducing a new dialog system. Tables scroll within their cards; forms collapse on the existing mobile breakpoint.

Before the migration is applied, CSR/Reports/organisation Settings show a specific migration-required error and Retry; they do not silently render fabricated zero metrics. Account name editing remains independent. Volunteer booking remains available against the existing RPC; missing availability uses “Availability checked when booking” rather than calculating misleading totals from RLS-limited rows. Aggregate availability can be stale; saving is always authoritative. Existing Admin Dashboard's old booked counter still describes its existing individual bookings; it was not redesigned into a combined report.

## Final database review — 17 September 2026

This is a static, source-based review of the revised draft. The migration has **not been applied or executed**, locally or remotely. The existing RPC bodies were not redesigned.

### Issues found and limited corrections

1. **Charities supported:** the original generated schema/type/input accepted generic text, but no names-list or description-specific behaviour was implemented or documented. The clarified requirement is a count, so `charities_supported` is now nullable integer with `CHECK (charities_supported IS NULL OR charities_supported >= 0)`. TypeScript uses `number | null`. The UI says **Number of other charities supported (if known)**, accepts whole numbers from zero through PostgreSQL's integer maximum, and submits blank as NULL rather than zero. No existing live data conversion is needed because this table does not yet exist.
2. **Sequence default grants:** the draft previously granted intended USAGE without first removing any deployment-role default sequence privileges. It now revokes ALL from PUBLIC, anon and authenticated on all three new identity sequences, then grants only USAGE on company/note sequences to authenticated. Corporate booking sequence access remains with the definer owner. No authenticated `setval`/sequence UPDATE privilege is deliberately granted. Company/note sequence USAGE is role-wide and is not row-filtered by RLS; it permits advancing those sequences, not accessing protected rows.
3. **Isolation assumption:** an unchanged slot row can be locked after another reservation commits while a REPEATABLE READ transaction still sees its older reservation snapshot. Row locking alone does not invalidate that snapshot. The three new mutation entry points (`save_corporate_booking`, `csr_guard_individual_capacity`, `csr_guard_slot_capacity`) now reject non-READ-COMMITTED snapshot modes with SQLSTATE `25000`. PostgreSQL READ UNCOMMITTED is allowed because it has READ COMMITTED semantics. This is a fail-closed precondition, not a new locking model. Existing individual RPC code still has exactly the previously documented capacity-only edit; its INSERT trigger enforces the precondition. Individual DELETE and status-only attendance updates are not changed. All corporate RPC saves share the same isolation requirement, including edits that could reduce capacity. SERIALIZABLE is also rejected to keep every capacity writer on one supported snapshot strategy; callers must start a fresh READ COMMITTED transaction, not retry the same unsupported isolation level. The stale-snapshot finding is an inference from [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html); no concurrent database test was run.
4. **Attendance rounding:** numeric(12,2) rounds before the table CHECK. A negative RPC input such as -0.001 could previously become stored zero; a zero-attendance input with +0.001 hours could do the same. The corporate RPC now rejects raw negative hours and any raw positive hours paired with zero attendance before storage coercion. The existing attendance CHECK remains unchanged.

Only the migration, count field UI/type, static migration tests, this handoff and the staging checklist were changed for this review. No new RPC, table, dependency or migration filename was introduced.

### Corporate event/slot consistency — unchanged

The two separate foreign keys establish existence, not a declarative pairwise match. Current unprivileged client writes cannot create a mismatch: authenticated has SELECT only on corporate bookings, there is no INSERT/UPDATE RLS policy, and the only client write RPC derives `event_id` from the locked slot. The slot UPDATE trigger rejects changing the event of any slot with corporate history, including Cancelled rows. This is sufficient for the current client write surface.

A cross-table CHECK is not appropriate. Declarative enforcement would require a composite FK `(event_slot_id,event_id)` plus a referenced UNIQUE `(id,event_id)` on the existing slots table; this adds a redundant parent index/constraint and is not necessary for the stated write model. It is deliberately not added in this review. Database-owner/service-role manual corporate writes remain trusted and can bypass the RPC invariant; a future WMS or other privileged writer must use the RPC or motivate that composite FK. The draft does not claim a pairwise constraint exists. [PostgreSQL constraint rules](https://www.postgresql.org/docs/current/ddl-constraints.html) describe these requirements.

### Availability scope — unchanged

`get_slot_availability()` returns only `event_slot_id` and combined `remaining`. It does not return company ids/names, contacts, notes, financial data, group rows or separate corporate totals. Aggregate occupancy is intentionally visible to signed-in users, matching the existing authenticated slot-reading model; it is not a claim that all occupancy information is secret.

`fetchEventSlotsForVolunteer()` currently loads all slots and availability together into the volunteer provider. The selected event modal consumes the matching subset. The UI does not inherently need all historical availability to show one modal, but the implemented data flow deliberately preloads the whole schedule once rather than making a request for each selection. An event/slot parameter would become useful with a selected-event/lazy-loading change or measured dataset growth. Changing the signature alone would not improve the existing preload flow. There is no measured need to make that additional frontend/data-flow change now. The all-slot API and fallback for unavailable counts therefore remain unchanged. DBA should inspect query plans/page limits at realistic volume, including the lookup on individual `bookings.event_slot_id` (a foreign key alone does not guarantee an index).

### New function privilege audit

| New function | Security mode / volatility | Explicit search_path | PUBLIC / anon EXECUTE | authenticated EXECUTE |
| --- | --- | --- | --- | --- |
| `csr_touch_updated_at()` | INVOKER / default VOLATILE | empty | Revoked | Revoked |
| `csr_reserved_spaces(bigint,bigint)` | DEFINER / STABLE | empty | Revoked | Revoked |
| `save_corporate_booking(...)` | DEFINER / default VOLATILE | empty | Revoked | Granted; checks uid and is_admin |
| `get_slot_availability()` | DEFINER / STABLE | empty | Revoked | Granted; only rows for non-NULL auth.uid |
| `csr_guard_individual_capacity()` | DEFINER / default VOLATILE | empty | Revoked | Revoked |
| `csr_guard_slot_capacity()` | DEFINER / default VOLATILE | empty | Revoked | Revoked |

Only the two intended **new** client RPCs receive authenticated execution. Every table/function reference in empty-search-path code is schema-qualified. Built-in SQL operators, aggregate functions and `now()` resolve through the implicit `pg_catalog`; trigger variables (`NEW`, `OLD`, `TG_OP`) are not relation lookups. The new isolation check explicitly uses `pg_catalog.current_setting`.

The migration creator must have EXECUTE when creating triggers and must own/have the required table privileges. Trigger execution does not require granting the invoking client direct execution of the trigger function; the timestamp trigger only assigns NEW, while capacity triggers run as their definer. Internal helper calls require that the definer owners have helper EXECUTE and table access (normally the same migration/database owner); DBA must verify actual ownership, inherited memberships and default ACLs. See [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html) and [Supabase function privileges](https://supabase.com/docs/guides/database/functions).

New table grants remain explicit and RLS-protected: companies SELECT/INSERT/UPDATE, bookings SELECT only, notes SELECT/INSERT with current creator, singleton settings SELECT/UPDATE. No client DELETE is granted on the new tables. Existing function owners/grants/search paths and existing RLS are not rewritten. The two pre-existing RPC replacements retain their original explicit `search_path = public` and access checks. Do not confuse the retained existing RPC permissions with the stricter new-function ACL list.

### Capacity mutation review

The following conclusions assume initially valid capacity, enabled triggers, the declared grants/RLS, and use of the supported transaction mode. They are reasoning from SQL, **not observed concurrency results**. Subsequent queries in the volatile mutation routines can refresh their snapshot after the slot lock is acquired; the STABLE aggregate helper uses its calling query's snapshot. See [PostgreSQL function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html).

| Path | Serialization / invariant protection |
| --- | --- |
| Individual `book_event_slot` | Existing target FOR UPDATE precedes count; extended corporate sum; INSERT trigger independently rechecks and rejects unsupported isolation. |
| Direct admin individual INSERT | BEFORE trigger locks target, counts all individual rows plus corporate places, and rejects overflow before insert. Multi-row statements must be staged to verify preceding own-row visibility. |
| Individual slot reassignment | Target slot lock/count/guard protects any increase there. Removing the old-slot row cannot increase old occupancy; concurrent readers may temporarily overcount and conservatively reject. |
| Individual DELETE cancellation | Removes a reservation only. No lock protocol change or new Cancelled status; concurrent checks may conservatively count a soon-to-be-deleted row. |
| Corporate create | Admin RPC; target slot lock; individual count + non-cancelled team sum + requested team checked before insert. |
| Corporate team-size increase | Corporate row lock serializes edits; target slot lock; excludes edited row before checking requested replacement size. |
| Corporate team-size decrease | Same lock/check path, replaces rather than double-counts own team; cannot itself increase occupancy. |
| Corporate slot move | Corporate row locked; old and target slot rows locked in id order; checks target excluding self; update atomically changes both slot and derived event. |
| Corporate cancellation | Corporate row and slot locks; Cancelled no longer contributes to the sum once committed; no DELETE. |
| Corporate reactivation | Same reservation check as increase/create and event/date validation; cannot reactivate into a full slot. |
| Event-slot capacity decrease | UPDATE obtains the slot tuple lock; trigger counts reservations and compares against NEW.capacity. Other reservation writers use conflicting slot locks. |
| Event-slot event_id change | Same slot lock; rejects any individual or corporate history; corp Cancelled history also blocks moving the slot. |
| `save_event_with_slots` replacement | Extended existence guard plus existing restrictive booking FKs and delete row locks. Racing inserts must either hold the slot and make deletion fail, or wait and find the slot gone. Event/slot lock inversion can cause an abort/deadlock, not a committed overbooking. |

No remaining overcapacity commit path was identified for those client paths under the stated preconditions. Unsupported snapshot modes are now rejected rather than merely documented as an assumption. Privileged owner/service-role direct corporate writes, disabling triggers or changing grants can still violate invariants and are outside this client guarantee. Existing overbooked data is not automatically repaired. Deadlocks and conservative capacity rejections can still occur and require caller retry where appropriate. The pre-existing event-cancellation/booking lifecycle race is distinct from capacity and remains unchanged.

### Corporate attendance acceptance matrix

For a Completed row on a valid ended shift:

| Case | Result / reason |
| --- | --- |
| Either attendance field NULL | Rejected; explicit IS NOT NULL terms make the CHECK false, not unknown. |
| Negative attendance | Rejected by count range. |
| Negative hours | Rejected by CHECK; raw negative RPC inputs are now also rejected before rounding. |
| Attendance > team size | Rejected by count range. |
| Zero attendance + zero hours | Accepted: a completed group with nobody attending. |
| Zero attendance + positive hours | Rejected; raw sub-cent positive RPC hours also rejected before rounding. |
| Positive attendance + zero hours | Intentionally accepted: presence does not establish a nonzero recorded duration. |
| NaN hours | Rejected explicitly; PostgreSQL treats numeric NaN specially, so `>= 0` alone is insufficient. |
| Non-Completed with either attendance field non-NULL | Rejected, even if the supplied value is zero. Both fields must be NULL. |

Hours retain two decimal places. Positive hours with positive attendance may be rounded to that scale. Numeric infinities cannot fit the declared numeric(12,2) column. No individual attendance table, clock-in/out function or attendance-status semantics were changed.

### Migration safety and exact remaining DBA work

This remains an additive feature migration (new tables/indexes/functions/triggers, plus the two already documented minimum existing-function replacements). It contains no DROP of production objects, no old-policy replacement, no authentication change, no individual cancellation change, no individual attendance change and no mechanism that applies itself. The BEGIN/COMMIT text only has effect if the DBA later executes the file. The new guards additionally reject capacity mutations under unsupported isolation; this is the only newly imposed transaction-mode restriction.

DBA/staging must still verify:

1. Actual server version, live definitions, RLS enabled flags, function owners, default ACLs, inherited role memberships and table/sequence/RPC privileges. Use `has_function_privilege`/`has_sequence_privilege` to confirm the effective ACLs, not just policy text. Confirm service-role credentials are never client-exposed.
2. That the live `events.description` column exists as expected by the unchanged metadata RPC, and inspect the quoted `profiles.role` default without automatically altering it.
3. All 13 mutation paths above in independent READ COMMITTED transactions, including lock waits, failed/rolled-back mutations, opposing moves, admin multi-row INSERT/UPDATE, cancellation/reactivation and capacity shrink races. Verify REPEATABLE READ and SERIALIZABLE capacity mutations fail with 25000, and start a new READ COMMITTED transaction to retry.
4. RLS denial for anon/volunteers; direct authenticated corporate writes denied; RPC event/slot derivation; direct booked-slot event changes denied; helper/trigger execution through their real owners succeeds despite revoked client EXECUTE.
5. Every attendance case above, including -0.001 and zero-attendance +0.001 RPC inputs, NULL, NaN, infinities and completed identity restrictions; charities NULL/0/positive/negative/fractional/overflow behaviour and edit round trip.
6. Existing event creation/edit/cancel, individual reservation uniqueness/cancellation, auth, QR attendance, notifications and no-shows after the reviewed draft is installed in staging. Existing assumptions/defects are not migration backfills.
7. Availability query plans/API row limits against actual volume, and the future privileged-writer contract if WMS is added. No new composite pair constraint was added and no performance claim was measured.

No real concurrency, RLS or migration execution is claimed. Syntax parsing and automated tests cannot substitute for these staging checks.

## Verification results

- TypeScript: `npx tsc --noEmit` — PASS.
- ESLint: `npm run lint` — PASS after fixing effect initialization.
- Production build: `npm run build` — PASS; all 15 static pages generated, including CSR/Reports/Settings.
- `node --test --test-isolation=none tests/*.test.mjs` — 13/13 PASS. Covers recorded minutes vs capacity, NULL minutes, cancelled groups, combined filters, zero denominators, corporate participation semantics, CSV escaping/formula protection, static migration invariants, capped server pages rejection of incomplete pagination, integer charity counts, new-function/sequence ACL declarations, isolation preconditions and pre-rounding attendance checks.
- PostgreSQL parser: pglast 8.4 parsed all 51 SQL statements; its raw PL/pgSQL parser parsed all six PL/pgSQL definitions without syntax errors. The high-level JSON wrapper had a serialization error on trigger output, so raw parser output was used. This verifies grammar only, not database object resolution or runtime behaviour.
- Exact supplied-function comparison — PASS for both replaced RPCs; only documented changes.
- Browser: existing sign-in rendered at desktop and 390px mobile; password-reset form opened without submitting email; 768px tablet reset form inspected; no runtime errors in the initial unauthenticated smoke test. Direct `/admin/csr` navigation returned to sign-in.
- Mocked admin browser verification was attempted but blocked by cross-origin interception in the test harness before the new screens rendered; it is NOT a passing feature test. Synthetic session and routes were removed afterward.
- No SQL execution, SQL engine validation, RLS execution, concurrent database transactions, authenticated admin/volunteer flows, OAuth completion, email delivery, QR clock-in/out or no-show processing was tested against live Supabase. Static SQL checks are not a substitute for these. See the staging checklist.

Initial test-worker execution encountered Windows sandbox `spawn EPERM`; running Node tests without process isolation passed. Initial build detected file-encoding errors, which were corrected to UTF-8 before the successful build. No outstanding TypeScript/lint/build errors remain.

## Assumptions, risks and DBA review

1. Confirm current live definitions still match the supplied source before replacing either function. Preserve ownership and existing grants; CREATE OR REPLACE preserves them, but deployment ownership must allow the definer functions to read/write the new tables.
2. Review the exact RLS/grants, sequence grants, trigger execution privileges, Data API exposure, hardened search paths and application RPC signatures. No PUBLIC execute should remain on new RPCs/internal helpers.
3. Validate new constraints with NULL, NaN, negative, zero and over-team attendance values. Validate corporate event/slot derivation and denial of direct authenticated booking writes.
4. Test READ COMMITTED concurrency in a disposable staging database: individual/individual, group/group, individual/group, opposite slot moves, cancellation/reactivation, and capacity edits. Retry transaction-abort/deadlock errors; capacity mutations in REPEATABLE READ/SERIALIZABLE are rejected; retry in a new READ COMMITTED transaction.
5. Existing direct admin booking and slot writes now reject shared-capacity violations. Review any external scripts relying on those writes. Service-role/database-owner manual writes remain privileged and must use the same controlled workflow.
6. Existing individual legacy NULL-slot rows are not assigned to arbitrary shifts or counted against all shifts. Audit them separately. They remain visible in event reporting. Existing historical event/date/nullability inconsistencies are not migrated or backfilled.
7. Corporate event cancellation retains company records and reports the event as cancelled; no corporate notification backend exists. Corporate booking statuses are not automatically rewritten by the unchanged `cancel_event` function. Admins can cancel outstanding groups explicitly. Completed history remains immutable in identity through the RPC.
8. Confirm company financial estimates are intended to be ZAR; the database stores a numeric estimate without a currency column. CSR figures are manual and nullable, never scraped.
9. Validate `events.description` and quoted role-default discrepancies separately. Maintain the full live production schema/function history in source control as separate technical debt; this is not a destructive baseline migration.
10. New feature screens and full authenticated regression coverage require staging credentials and an independently reviewed migration application. The application code is implemented, but deployment readiness is conditional on those checks. Do not infer production readiness from compilation alone.

Future WMS can own events/slots/capacity while this application supplies booking changes and cancellations. No separate corporate capacity source or fake WMS endpoint is introduced. Shared capacity is isolated in the slot-locking RPCs/helper/guards. A future WMS writer must respect those locks and guard constraints; future attendance ingestion must preserve recorded-minute and aggregate-attendance provenance.

## Full migration SQL

```sql
-- REQUIRES DATABASE ADMIN REVIEW - NOT YET APPLIED
-- Additive feature migration against the supplied live schema, not a baseline.
begin;

create table public.corporate_companies (
  id bigint generated by default as identity primary key,
  name text not null check (btrim(name) <> ''),
  industry text, website text, location text,
  contact_name text, contact_email text, contact_phone text,
  relationship_status text not null default 'Lead'
    check (relationship_status in ('Lead','Contacted','Interested','Active Partner','Inactive')),
  charities_supported integer
    check (charities_supported is null or charities_supported >= 0),
  estimated_annual_csr numeric(14,2)
    check (estimated_annual_csr >= 0 and estimated_annual_csr <> 'NaN'::numeric),
  csr_focus_areas text,
  partnership_potential text not null default 'Medium'
    check (partnership_potential in ('Low','Medium','High')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.corporate_bookings (
  id bigint generated by default as identity primary key,
  company_id bigint not null references public.corporate_companies(id) on delete restrict,
  event_id bigint not null references public.events(id) on delete restrict,
  event_slot_id bigint not null references public.event_slots(id) on delete restrict,
  contact_name text, contact_email text,
  team_size integer not null check (team_size > 0),
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Completed','Cancelled')),
  notes text, attendance_count integer, volunteer_hours numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_attendance_valid check (
    (status = 'Completed' and attendance_count is not null and volunteer_hours is not null
      and attendance_count between 0 and team_size and volunteer_hours >= 0 and volunteer_hours <> 'NaN'::numeric
      and (attendance_count > 0 or volunteer_hours = 0))
    or (status <> 'Completed' and attendance_count is null and volunteer_hours is null)
  )
);
create index corporate_bookings_slot_idx on public.corporate_bookings(event_slot_id);
create index corporate_bookings_event_idx on public.corporate_bookings(event_id);
create index corporate_bookings_company_idx on public.corporate_bookings(company_id);

create table public.corporate_notes (
  id bigint generated by default as identity primary key,
  company_id bigint not null references public.corporate_companies(id) on delete restrict,
  body text not null check (btrim(body) <> ''),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index corporate_notes_company_idx on public.corporate_notes(company_id);

create table public.organisation_settings (
  id integer primary key default 1 check (id = 1),
  organisation_name text not null default 'Ladles of Love' check (btrim(organisation_name) <> ''),
  default_location text not null default '', contact_email text not null default '',
  timezone text not null default 'Africa/Johannesburg' check (timezone = 'Africa/Johannesburg'),
  booking_confirmation_enabled boolean not null default false,
  booking_cancellation_enabled boolean not null default false,
  shift_reminder_enabled boolean not null default false,
  corporate_booking_confirmation_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.organisation_settings(id) values (1);

alter table public.corporate_companies enable row level security;
alter table public.corporate_bookings enable row level security;
alter table public.corporate_notes enable row level security;
alter table public.organisation_settings enable row level security;

revoke all on public.corporate_companies, public.corporate_bookings,
  public.corporate_notes, public.organisation_settings from public, anon, authenticated;
grant select, insert, update on public.corporate_companies to authenticated;
grant select on public.corporate_bookings to authenticated;
grant select, insert on public.corporate_notes to authenticated;
grant select, update on public.organisation_settings to authenticated;
-- Clear possible Supabase/default sequence grants, including setval privileges.
revoke all on sequence public.corporate_companies_id_seq,
  public.corporate_bookings_id_seq, public.corporate_notes_id_seq
  from public, anon, authenticated;
grant usage on sequence public.corporate_companies_id_seq, public.corporate_notes_id_seq to authenticated;

create policy corporate_companies_admin_select on public.corporate_companies for select to authenticated using ((select public.is_admin()));
create policy corporate_companies_admin_insert on public.corporate_companies for insert to authenticated with check ((select public.is_admin()));
create policy corporate_companies_admin_update on public.corporate_companies for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy corporate_bookings_admin_select on public.corporate_bookings for select to authenticated using ((select public.is_admin()));
create policy corporate_notes_admin_select on public.corporate_notes for select to authenticated using ((select public.is_admin()));
create policy corporate_notes_admin_insert on public.corporate_notes for insert to authenticated with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy organisation_settings_admin_select on public.organisation_settings for select to authenticated using ((select public.is_admin()));
create policy organisation_settings_admin_update on public.organisation_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.csr_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.csr_touch_updated_at() from public, anon, authenticated;
create trigger corporate_companies_updated before update on public.corporate_companies for each row execute function public.csr_touch_updated_at();
create trigger corporate_bookings_updated before update on public.corporate_bookings for each row execute function public.csr_touch_updated_at();
create trigger organisation_settings_updated before update on public.organisation_settings for each row execute function public.csr_touch_updated_at();

-- All non-cancelled corporate rows retain their reserved places, including history.
-- Internal helper: never expose corporate totals or contact information through it.
create function public.csr_reserved_spaces(p_slot_id bigint, p_exclude_id bigint default null)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(team_size), 0)::bigint from public.corporate_bookings
  where event_slot_id = p_slot_id and status <> 'Cancelled'
    and (p_exclude_id is null or id <> p_exclude_id);
$$;
revoke all on function public.csr_reserved_spaces(bigint,bigint) from public, anon, authenticated;

-- One controlled entry point for create, resize, move, cancellation, reactivation,
-- and aggregate attendance. Direct corporate booking writes are not granted.
create function public.save_corporate_booking(
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
  v_count bigint;
  v_new_reservation boolean;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Only administrators can manage corporate bookings.'; end if;
  -- Slot locks serialize writers, but cannot refresh a REPEATABLE READ snapshot.
  -- PostgreSQL READ UNCOMMITTED has the same snapshot semantics as READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Shared capacity mutations require READ COMMITTED isolation.' using errcode = '25000';
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
    if v_event.date is null or v_event.date::date < current_date then raise exception 'Past event slots cannot be booked.'; end if;
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
    select count(*) into v_count from public.bookings where event_slot_id = v_slot.id;
    if v_count + public.csr_reserved_spaces(v_slot.id, p_id) + p_team_size > v_slot.capacity then
      raise exception 'The team exceeds the remaining capacity of this time slot.';
    end if;
  end if;
  if p_id is null then
    insert into public.corporate_bookings(company_id,event_id,event_slot_id,team_size,status,contact_name,contact_email,notes,attendance_count,volunteer_hours)
    values(p_company_id,v_slot.event_id,v_slot.id,p_team_size,p_status,p_contact_name,p_contact_email,p_notes,p_attendance_count,p_volunteer_hours)
    returning * into v_result;
  else
    update public.corporate_bookings set company_id=p_company_id,event_id=v_slot.event_id,event_slot_id=v_slot.id,
      team_size=p_team_size,status=p_status,contact_name=p_contact_name,contact_email=p_contact_email,notes=p_notes,
      attendance_count=p_attendance_count,volunteer_hours=p_volunteer_hours where id=p_id returning * into v_result;
  end if;
  return v_result;
end;
$$;
revoke all on function public.save_corporate_booking(bigint,bigint,bigint,integer,text,text,text,text,integer,numeric) from public, anon, authenticated;
grant execute on function public.save_corporate_booking(bigint,bigint,bigint,integer,text,text,text,text,integer,numeric) to authenticated;

-- Privacy-safe shared availability; no identities or separate corporate counts.
create function public.get_slot_availability()
returns table(event_slot_id bigint, remaining bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, greatest(0::bigint, s.capacity - (select count(*) from public.bookings b where b.event_slot_id=s.id)
    - public.csr_reserved_spaces(s.id))
  from public.event_slots s where auth.uid() is not null order by s.id;
$$;
revoke all on function public.get_slot_availability() from public, anon, authenticated;
grant execute on function public.get_slot_availability() to authenticated;

CREATE OR REPLACE FUNCTION public.book_event_slot(p_event_slot_id bigint)
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

  if v_event_date < current_date then
    raise exception 'Past event slots cannot be booked.';
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

  if v_booking_count + public.csr_reserved_spaces(v_slot.id) >= v_slot.capacity then
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

CREATE OR REPLACE FUNCTION public.save_event_with_slots(
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

    -- Current behaviour:
    -- slots with individual bookings cannot be replaced.

    if exists (
      select 1
      from public.bookings
      where event_id = p_event_id
        and event_slot_id is not null
    ) or exists (
      select 1 from public.corporate_bookings where event_id = p_event_id
    ) then
      raise exception
        'Slots cannot be changed after individual or corporate bookings exist for this event.';
    end if;

    update public.events
    set
      title = trim(p_title),
      date = to_char(p_date, 'YYYY-MM-DD'),
      location = trim(p_location)
    where id = p_event_id
    returning *
    into v_event;

    delete from public.event_slots
    where event_id = p_event_id;

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

    if v_end_time <= v_start_time then
      raise exception
        'Each time slot must end after it starts.';
    end if;

    if v_capacity is null
       or v_capacity < 1 then
      raise exception
        'Each time slot must have a capacity of at least one.';
    end if;

    insert into public.event_slots (
      event_id,
      start_time,
      end_time,
      capacity
    )
    values (
      v_event.id,
      v_start_time,
      v_end_time,
      v_capacity
    );

  end loop;

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

-- Existing admin INSERT/UPDATE policies on bookings must not bypass shared capacity.
-- Status-only attendance updates and legacy NULL-slot rows retain existing behaviour.
create function public.csr_guard_individual_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_slot public.event_slots%rowtype; v_count bigint;
begin
  if tg_op = 'UPDATE' and new.event_slot_id is not distinct from old.event_slot_id
    and new.event_id is not distinct from old.event_id then return new; end if;
  if new.event_slot_id is null then return new; end if;
  -- Slot locks serialize writers, but cannot refresh a REPEATABLE READ snapshot.
  -- PostgreSQL READ UNCOMMITTED has the same snapshot semantics as READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Shared capacity mutations require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  select * into v_slot from public.event_slots where id = new.event_slot_id for update;
  if not found or v_slot.event_id is distinct from new.event_id then raise exception 'Booking event and slot must match.'; end if;
  select count(*) into v_count from public.bookings where event_slot_id = v_slot.id and id <> new.id;
  if v_count + public.csr_reserved_spaces(v_slot.id) + 1 > v_slot.capacity then raise exception 'This time slot is already full.'; end if;
  return new;
end;
$$;
revoke all on function public.csr_guard_individual_capacity() from public, anon, authenticated;
create trigger bookings_shared_capacity before insert or update of event_slot_id,event_id on public.bookings
for each row execute function public.csr_guard_individual_capacity();

-- Direct admin capacity edits already hold the slot row lock; prevent shrinking
-- a slot below reservations or moving a booked slot to a different event.
create function public.csr_guard_slot_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count bigint;
begin
  -- Slot locks serialize writers, but cannot refresh a REPEATABLE READ snapshot.
  -- PostgreSQL READ UNCOMMITTED has the same snapshot semantics as READ COMMITTED.
  if pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted') then
    raise exception 'Shared capacity mutations require READ COMMITTED isolation.' using errcode = '25000';
  end if;
  select count(*) into v_count from public.bookings where event_slot_id = old.id;
  if new.event_id <> old.event_id and (v_count > 0 or exists(select 1 from public.corporate_bookings where event_slot_id = old.id)) then
    raise exception 'A booked slot cannot be moved to another event.';
  end if;
  if new.capacity < v_count + public.csr_reserved_spaces(old.id) then raise exception 'Capacity cannot be reduced below reserved places.'; end if;
  return new;
end;
$$;
revoke all on function public.csr_guard_slot_capacity() from public, anon, authenticated;
create trigger event_slots_shared_capacity before update of capacity,event_id on public.event_slots
for each row execute function public.csr_guard_slot_capacity();

commit;
```
