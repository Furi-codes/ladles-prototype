# Admin Reports and Analytics completion audit — 2026-09-26

## Scope and safety

Branch: **AmienBranch**, starting HEAD `101667b`. Existing application changes and prior reports were preserved. No branch changes, commits, pushes, deployments, SQL changes, migrations, database resets or real-record mutations were performed. No new CSR portal was developed.

This supplements `FULL_SYSTEM_QA_REPORT.md` (September 25) and `REPORTS_ANALYTICS_FINAL_HANDOFF.md`; their earlier browser results are not represented as newly executed tests here. This resumed audit adds `tests/admin-audit.test.mjs`, extends `tests/report-loading.test.mjs`, and adds this report. The existing theme implementation remains intact.

Only public Supabase configuration variable names were inspected. No explicitly designated separate staging connection, disposable authenticated accounts and staging authorization were found. **Zero real authenticated Supabase integration tests were run.** Passing mocks and SQL text assertions do not establish deployed RPC, RLS or concurrency correctness.

## Executed checks

| Check | Actual result |
|---|---|
| `node --test tests/*.test.mjs` | PASS: 52 tests, zero failures/skips; previously 36 |
| `npm run lint` | PASS, exit 0 |
| `npx tsc --noEmit` | PASS, exit 0 |
| `npm run build` | PASS, Next.js 16.2.4 production compilation, TypeScript and all 15 static pages generated |
| `git diff --check` | PASS |
| Isolated browser fixture | Rendered actual Dashboard and ReportsManager with synthetic actions; no Supabase access |
| Real authenticated database / concurrency tests | NOT RUN; staging prerequisites absent |

Test evidence breakdown: 18 pure calculation tests, 18 mocked application/query tests, 16 SQL-source contract tests. Source assertions check text and intended guards; they neither execute PostgreSQL nor validate the deployed migration state.

| Test file | Count | Evidence |
|---|---:|---|
| access-review.test.mjs | 7 | 5 SQL-source, 2 mocked |
| data-pagination.test.mjs | 2 | Mocked |
| migration.test.mjs | 9 | SQL-source |
| report-analytics.test.mjs | 5 | Pure calculations |
| report-loading.test.mjs | 8 | Mocked |
| reporting.test.mjs | 7 | Pure calculations |
| admin-audit.test.mjs | 14 | 6 pure calculations, 6 mocked, 2 SQL-source |

The 16 added regressions cover all five current presets across a year boundary; open date bounds plus combined event/location filters; future reservations; cancelled-only data and unknown companies; missing recorded minutes; exact selected CSV output including BOM, Unicode, quoting, decimals and spreadsheet formula neutralization; corporate create/update RPC payload allowlisting; surfaced corporate validation errors; slot-availability compatibility versus permission failures; administrator RPC/search failures; unsigned account/access requests; own-account name trimming and user-ID scoping; corporate SQL validation guards; shared-capacity writers; 205 event IDs in 100/100/5 query batches; and rejection of attendance/company/corporate partial-load failures. Mocked server error responses do not prove that the server actually rejects those inputs.

## Feature inventory and coverage

| Implemented feature | Evidence and remaining limits |
|---|---|
| Corporate company creation/editing, contacts, industry, website, location, relationship, charity number, CSR/focus/potential and notes | Code inspected. Real save, constraints and RLS untested. |
| Company search, selected-company activity, timestamped append-only notes | Code inspected; authenticated behavior untested. |
| Corporate group create/edit, company/shift/team/contact fields, Pending/Confirmed/Completed/Cancelled, attendance/hours, cancellation reason | RPC payload/error mocks and SQL-source checks pass. Live state transitions untested. |
| Shared individual/corporate slot availability | Helper/writer/lock source contracts pass; aggregate RPC outcomes mocked. Live capacity, privacy and races untested. |
| Reports four summary cards | Pure fixtures pass: completed hours, unique active individual IDs, events with completed participation, attended/reserved rate. Browser fixture shows 6 hours, 0 identified individual volunteers, 1 completed event, 25% attendance. |
| Four charts | Monthly completed hours, monthly booked/attended, completed corporate hours by company, and current corporate status mix inspected and fixture-rendered. Cancelled status remains visible in status mix while excluded from participation totals. |
| Date filters and presets | Five current presets, rolling calendar clamping, inclusive Johannesburg event dates, custom/open bounds tested in pure functions. UI Custom retains current dates. Legacy preset helper remains tested and preserved. |
| Event/location, corporate-only and company filters | Calculation and loader mocks cover selection/scoping. Real search/RLS and full interaction combinations require staging. |
| CSV export | Pure exact-content and escaping tests pass; selected metrics and empty-export disabled state checked. Actual browser download/opening in Excel not retested this run. |
| Report loading, pagination, errors, retry and stale requests | Query mocks pass, source request-version/filter-identity guards inspected. Browser live-network delays, failure/retry and session expiry untested. |
| Accessible chart detail tables, legends/tooltips, empty states | Source inspected; fixture accessibility snapshot exposes named charts, focusable points, table headers and controls. Full keyboard/screen-reader audit not completed. |
| Dashboard original counters, operational booking/event tables and system state | Source inspected and empty operational fixture rendered. Live/realtime counters and no-show updates untested. |
| Dashboard 30-day analytics and View Full Reports | Actual component rendered with same synthetic metrics; shared report definitions inspected. |
| Settings notification preferences | Four-flag save allowlist inspected. No email-delivery implementation implied. Real persistence untested. |
| Organisation identity | Organisation editing UI removed; database identity protections inspected as source only. |
| Own account name, read-only email, password-reset guidance | Mock verifies unsigned failure, trimmed name and own-user filter. Real Auth/RLS/email untested. |
| Administrator listing and existing-profile search | Mock failures and source authorization inspected; debounced search, minimum length, limit and stale-response handling reviewed. Authenticated search privacy untested. |
| Administrator grant/revoke confirmation, cancel/busy/errors, self/final-admin protection | SQL-source and action mocks pass. Browser confirmation interaction and authenticated role changes/races untested. |
| Admin route/provider authentication and data refresh | Source inspected. Prior September 25 report records anonymous redirects; not rerun as authenticated tests here. |

Reporting limitations remain explicit: corporate participant identities cannot contribute unique individual volunteer IDs; bookings alone do not create completed hours; individual hours require recorded checkout and minutes; future reservations can enter the denominator; deleted individual bookings cannot reconstruct historical gross cancellations.

## Visual QA

The existing implementation reuses `admin.module.css` card, header, body, statistic and table conventions. Reports-only chart variables use the existing palette; no UI dependency, font or design system was introduced. Prior handoff documents comparison with Events, Volunteer Rosters and Corporate CSR and both themes at 375/768/1440 widths.

This run regenerated `tests/render-report-preview.mjs`, bundled the real components with esbuild, served only `.exports/reports-verification` on localhost:3101, and inspected screenshots at **1440 desktop/light, 768 tablet/light and 375 mobile/dark**. Charts, long company names, controls and metric cards render with the established surfaces and responsive stacking. The actual chart fixture reconciles 12 reserved places, 3 attended, 6 hours and one booking in each of four statuses. An empty fixture disables Export CSV. Browser error collection returned no errors. Fixture search actions intentionally return no results and cannot establish live search behavior. Fixture typography does not prove remote font delivery in the deployed application.

**Known pre-existing layout limitation:** the original dashboard operational table/grid expands beyond the viewport at tablet/mobile widths (720px table minimum). This is visible in the combined fixture. New report tables scroll within their containers; do not interpret the whole-dashboard screenshots as a clean no-overflow pass. Unrelated dashboard CSS was left unchanged to preserve scope. Full deployed authenticated responsive/accessibility checks remain required.

## Database/security inspection findings — not integration verification

1. `csr_reserved_spaces` includes every non-Cancelled corporate team's places, including Completed. Individual and corporate writers include both populations. Corporate edits exclude their own reservation, lock old/new slots in sorted order, and reject over-capacity changes. Individual booking and guard triggers lock the target slot; slot shrinking checks both populations. These are source findings only.
2. Corporate validation covers allowed status, positive team size, company existence, event/slot identity, past/cancelled reservations, completed-event timing, attendance bounds and nonnegative hours, including small raw negative values and zero-attendance positive hours. Completed booking identity is protected; valid attendance corrections remain possible.
3. Capacity routines require the supported transaction isolation. Legacy individual records with a null slot are outside slot-capacity accounting. Confirm whether such records exist in staging before drawing reconciliation conclusions.
4. `set_profile_admin_access` checks caller identity/admin role, serializes with a profiles lock, rechecks authorization after waiting and guards self/final-admin revocation. Direct role UPDATE protection depends on trigger execution/ownership assumptions. Profile INSERT role escalation and profile DELETE protections depend on existing live policies, not just the new migration.
5. New corporate/settings grants and admin RLS policies, internal helper execution restrictions, and the organisation identity INSERT/UPDATE trigger are present in migration source. Organisation name is fixed to `Ladles of Love`; notification updates should remain allowed. Deployment state cannot be inferred from repository comments or past handoff claims.
6. The cancellation wrapper protects existing completed corporate history and cancels active groups transactionally. **New corporate booking versus concurrent event cancellation needs special staging coverage:** booking reads event state without the same explicit event lock; the original `cancel_event` implementation is not defined in these migrations. No race defect is asserted without executing the schedules. Review the old function, function owners, grants and public-schema privileges as well.
7. Operational dashboard data loaders remain unpaginated and may truncate at the API row cap. The Reports loader has pagination tests. This is an inspected limitation, not a demonstrated live truncation.

Official RLS guidance distinguishes grants from row policies: https://supabase.com/docs/guides/database/postgres/row-level-security . Neither can be certified by frontend mocks.

## Exact manual staging checklist

Run only after explicit authorization for a **separate disposable staging project**. Record project reference and confirm it differs from production; provision disposable admins A/B and volunteers V1/V2, plus an anonymous client. Have the DBA confirm deployed function definitions, owners, triggers, grants and RLS from read-only inspection. Do not automatically apply migrations or reset any database. Use each user's authenticated JWT for permission tests; service-role bypass is not evidence of RLS. Create and clean up only specifically approved test fixtures, recording their IDs.

1. **Access matrix:** as anonymous and V1 attempt SELECT/INSERT/UPDATE/DELETE against companies, groups, notes and settings and call every admin RPC. Expect denial/no private rows. As A confirm only intended reads/writes succeed. Check availability returns aggregate counts without company/contact data. Confirm cross-user profile updates are denied.
2. **Role escalation and identity:** V1 attempts direct profile role UPDATE and INSERT/upsert containing `role=admin`; try unauthorized profile deletion. A attempts self-revocation, nonexistent target and invalid role; expect errors. A grants then revokes V1 using the intended RPC; refresh V1 session and verify access. Try changing organisation name via INSERT/UPDATE/upsert including null, spelling/case/whitespace variants; expect rejection. Save each of the four preferences and verify name unchanged. Check settings delete privileges separately.
3. **Role concurrency:** with A/B as the only disposable admins, start reciprocal revocations in two authenticated sessions concurrently. Expect serialized authorization, no zero-admin state, and a waiting caller who lost admin access to fail after acquiring the lock. Exercise final-admin guard without demoting a real account; inspect results and both error responses.
4. **Corporate validation:** create future/past/cancelled test events and slots. Submit team size null/0/-1, nonexistent company/slot, invalid status, mismatched event input, new Completed, past/cancelled new reservation, attendance above team size or negative, negative hours including -0.001, zero attendees with 0.001 hours and nonfinite hours where transport allows. Expect no invalid row. Complete only an ended event with valid counts; ensure identity/team/slot changes are rejected and permitted corrections succeed. Non-Completed rows must not retain completed metrics. Test cancellation reason and UI error propagation.
5. **Sequential capacity:** capacity 10, two individual bookings plus Pending team 3 and Confirmed team 2 must leave 3. Completing a team must retain reserved capacity; cancelling it releases its spaces. Reject a team of 4 when only 3 remain, shrinking below reservations, and moving/deleting a slot with protected history. Verify individual bookings and direct permitted individual writes obey the same rule. Verify no duplicate individual booking for the event.
6. **Last-seat concurrency:** fresh capacity-1 slot; issue corporate team-1 and individual-1 reservations simultaneously in separate authenticated sessions, repeat with reversed start order. Also use a controlled transaction held open on the slot in an approved SQL test harness to force the second writer to wait, then commit. Exactly one reservation succeeds and total reserved never exceeds 1. Repeat corporate-versus-corporate, individual-versus-individual, corporate growth versus individual, opposing slot moves, and capacity shrink versus new reservation. Use bounded timeouts and verify rollback leaves no partial changes.
7. **Cancellation races:** concurrently cancel an event and create/reactivate/move/grow a group into it; also cancel versus recording completion. Force both orderings with controlled transactions where possible. After commit there must be no active reservation added to a cancelled event, and completed corporate history must prevent invalid cancellation. Verify individual cancellation behavior and notices through the existing original function. Record actual function definitions and transaction results if an invariant fails.
8. **Known reporting data:** ended event with two individual reservations (one recorded 90-minute checkout, one no-show), plus Completed corporate team 4 / attendance 3 / hours 6. Expect 7.5 hours, 1 active individual, 1 completed event, 4/6 attendance = 66.7%; charts and CSV reconcile. Add cancelled groups/events and confirm exclusions while current corporate cancellation status remains visible. Missing checkout/minutes must not add hours. Add future reservations and confirm documented denominator behavior.
9. **Filters and export:** exercise each five date presets across month/year boundaries and Johannesburg midnight, custom inclusive endpoints, empty endpoints, reversed dates, event, location, corporate-only and company selections; confirm visible rows, all cards/charts and downloaded CSV agree. Test quotes, commas, newlines, Unicode and leading =/+/-/@ cells in approved fixture names; open CSV in the intended spreadsheet application and ensure formulas are not executed.
10. **Pagination and failures:** use more than the configured REST row limit and over 200 selected event IDs in approved synthetic staging data. Reconcile full totals independently. Block a relation request, expire the session and rapidly change filters; verify errors hide stale/partial metrics and export, retry recovers, and older responses never replace the newest selection.
11. **Authenticated browser QA:** desktop 1440, tablet 768, mobile 375, both themes; compare Reports and preview against Dashboard, Events, Rosters and Corporate CSR. Check keyboard focus/tooltips, expandable chart tables, long names, internal table scrolling, all filters, CSV download and full-report navigation. Record the existing dashboard overflow separately. Exercise settings persistence, role confirmations/cancel/busy/errors, realtime refresh and no-show updates with disposable data. Authentication, OAuth, password-reset email and QR/attendance device flows remain outside the isolated fixture evidence.

Release conclusion: local code checks and regression tests pass. Authenticated staging security, transactional capacity, cancellation races and deployed schema assumptions remain unverified release checks; this audit does not certify them.
