# Reports & Analytics final handoff

Implemented on the existing `AmienBranch`. This document supersedes the report UI and metric descriptions in the earlier handoffs; their unrelated access/CSR migration guidance remains unchanged.

## Settings and scope

The pre-existing working-tree edit already removed the Organisation heading, name, default location, contact email, timezone and explanatory text. That removal was retained. Notifications, admin access and account controls remain. The unused organisation save handler was removed, and notification updates now allow only the four notification preferences, including protection against unexpected runtime properties. Shared settings columns/types and Africa/Johannesburg scheduling were preserved.

No booking/cancellation/capacity functions, authentication flows, migrations, database policies or database records were modified. No merge, push, deployment or production SQL was performed. The pre-existing untracked `env.local.txt` was left untouched.

## Data sources and authorisation

Inspection used the checked-in migrations, types, queries, booking cancellation code and earlier schema handoff. This was not a live schema inspection or staging integration test. No authoritative reporting RPC exists in the inspected source; existing `loadReportData`, pagination and `performanceRows` are reused.

`loadReportData` checks the existing Postgres `is_admin()` RPC before loading records. Each underlying query continues to use the caller's Supabase client and existing RLS. The client check is not a replacement for RLS. No privileged keys, new public endpoint or company records are exposed to public pages.

| Display | Actual source |
| --- | --- |
| Volunteer Hours Over Time | `events.date`, individual `bookings` joined to `attendance_records.worked_minutes` with both timestamps, plus Completed `corporate_bookings.volunteer_hours` |
| Booked vs Attended | Individual booking records and clock-ins; non-cancelled corporate `team_size` versus Completed `attendance_count`, grouped by event month |
| Corporate Contributions | Completed `corporate_bookings.volunteer_hours`, grouped by `company_id`, labelled with admin-only `corporate_companies.name`, descending hours |
| Corporate Booking Status | Current `corporate_bookings.status` for bookings whose parent event matches the filters; counts and percentages of booking records |
| Event performance / CSV | Existing shared `performanceRows` calculations; non-cancelled filtered events, slot capacity, individual and corporate totals |

The loader filters events on Supabase before fetching associated slots, bookings, corporate bookings and attendance. Exact-count pagination and bounded ID batches are retained. Corporate company queries remain subject to admin RLS.

## Summary definitions

All cards use inclusive **event dates**, not booking creation or clock-in timestamps, with the selected event/location/participation scope.

1. **Completed Volunteer Hours:** sum of recorded individual minutes divided by 60, only when clock-in and clock-out are present, plus the aggregate hours manually recorded on Completed corporate bookings. Missing individual minutes add no verified hours. Cancelled events/bookings are excluded. Reservations never generate estimated hours.
2. **Active Volunteers:** distinct individual `bookings.user_id` values with a clock-in at an included non-cancelled event. Corporate identities are not recorded individually; they cannot reliably be deduplicated, so this card describes individual volunteers and displays Unavailable in corporate-only mode.
3. **Completed Events:** distinct non-cancelled events with either a clocked-out individual attendance record with recorded minutes, or a Completed corporate booking with positive attendance. The event schema only has Scheduled/Cancelled; this is evidence of completed participation, not an administrative completion status. It does not claim every booking at that event has finished.
4. **Attendance Rate:** individual clock-ins plus Completed corporate attendance divided by individual booking records plus non-cancelled corporate team sizes. No booked places produces a dash. Future reservations in a custom range enter the denominator. Participants are activity instances and may overlap across individual/corporate records; this is not a count of unique people.

## Date filtering and cancellations

- Last 30 days: today and the preceding 29 days in Africa/Johannesburg.
- Last 3/6/12 months: the same local calendar day that many months ago through today, both inclusive; clamp to the target month's last day for month-end/leap-year boundaries. These can span 4/7/13 chart month buckets.
- Custom: editable inclusive endpoints; selecting Custom retains current dates. Blank boundaries include available history on that side. Reversed dates show validation and hide results/disable CSV.
- Date preset changes retain event, location and participation scope. Company applies to corporate-only scope. All applicable cards, charts and CSV derive from the same selected data. Old filter responses are not displayed under a newly selected date range.
- The status donut uses **event-date scope and current booking status**, regardless of booking creation date. It intentionally includes cancelled bookings/events. Their status visibility never contributes completed hours or attendance.
- Pending/Confirmed corporate bookings contribute booked places only. Completed bookings retain reservation sizes and recorded attendance. Cancelled bookings contribute neither booked places nor completed participation; cancelled events exclude both individual and corporate activity from those totals.
- Individual No show records remain in booked places; without a clock-in they contribute no attendance. Individual cancellations delete bookings in the existing workflow, so gross historical reservation counts and individual cancellation counts cannot be reconstructed.
- Event cancellation propagation and completed-history protection remain entirely in the existing database functions. No database change is proposed.

## UI and accessibility

Four summary cards and four complete charts are on Reports. The cards now reuse the existing admin card/stat/header/table classes in light and dark modes, including the established 10px corners, borders, typography and spacing. The dashboard reuses the same summary and a compact 30-day hours chart, retaining View Full Reports. Filters, CSV and event performance remain available.

SVG/CSS charts add no application dependencies. Charts use the existing admin status/brand colours, theme-aware legends, clear units, hover/touch/keyboard monthly inspection, explicit empty states and accessible data tables with captions and row/column headers. Company names wrap. The donut includes textual counts/percentages. Charts observe container size and reduce tick-label frequency at narrow widths without omitting data points. Tables contain any necessary horizontal scrolling. Errors show Retry and do not render misleading zero totals.

## Changed files

Added:

- `app/admin/components/ReportCharts.tsx`
- `app/admin/components/Reports.module.css`
- `tests/report-analytics.test.mjs`
- `tests/render-report-preview.mjs`
- `docs/REPORTS_ANALYTICS_FINAL_HANDOFF.md`

Changed:

- `app/admin/components/ReportsManager.tsx`
- `app/admin/components/DashboardAnalytics.tsx`
- `app/admin/components/PageHeader.tsx`
- `app/admin/components/SettingsManager.tsx` (retained pre-existing removal)
- `lib/reporting.ts`
- `lib/actions/corporate.ts` (extended pre-existing notification changes)
- `tests/reporting.test.mjs`
- `tests/report-loading.test.mjs`
- `tests/access-review.test.mjs`
- `eslint.config.mjs` (ignore generated isolated browser fixtures only)

Deleted files: none. Dependency/lockfile changes: none. Database changes: none.

## Verification

Requested checks: `npm run lint`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run build`, `git diff --check`.

Final results: lint passed with no warnings; standalone TypeScript passed; all 36 tests passed; the production build passed and generated all 15 pages; `git diff --check` passed. No staging integration run was performed.

The Node test runner initially hit sandbox `spawn EPERM`; the same requested test command passed outside the sandbox. Tests cover recorded calculations, cancellation exclusions, no-shows/reservations, missing checkout, unique volunteers, company scope, inclusive filtering, empty/reversed ranges, zero-filled months, timezone/month-end/leap-year presets, pagination, authorisation denial and load errors. Existing access, migration and capacity regression checks also run.

Local browser checks used agent-browser and isolated React chart fixtures, never fake database records. Populated charts were exercised at 375, 430, 768, 1024 and 1440 pixels; document width equalled viewport width at each size. Empty states, long company names, keyboard tooltip updates and expanding an accessible table were checked. No browser errors were reported. The locally built `/admin/reports` route redirected an unauthenticated browser to sign-in. These checks do not establish authenticated staging behaviour.

Reproduce the isolated visual fixture:

```powershell
node tests/render-report-preview.mjs
npx --yes esbuild .exports/reports-verification/entry.tsx --bundle --outfile=.exports/reports-verification/interactive.js --loader:.module.css=local-css '--define:process.env={}' --alias:@/lib/actions/corporate=./.exports/reports-verification/actions.ts
```

Open `.exports/reports-verification/light.html` and `dark.html`; append `?empty` for empty states. The fixture renders the actual Dashboard and Reports components and replaces data access only in the isolated test bundle. Generated bundles/screenshots stay in the ignored `.exports/reports-verification` directory. Esbuild and agent-browser were temporary verification tools, not installed application dependencies.

## Outstanding staging and DBA review

1. With staging admin/volunteer/anonymous accounts, confirm the live `is_admin()` RPC is executable by the intended callers and live RLS protects all report source tables. No new grants or migration are supplied; report permission failures remain explicit errors.
2. Reconcile real attendance records and CSR bookings against all cards, monthly totals, sorted company hours, donut percentages and CSV, including missing checkout/minutes and empty periods.
3. Test all presets/custom dates, event/location/company scopes, rapid filter changes, refresh failures and retries in an authenticated browser.
4. Verify cancellation capacity release, Pending/Confirmed capacity reservation, event cancellation propagation and Completed history protection on staging. Source regression tests do not substitute for database integration tests.
5. Check the complete authenticated Settings, dashboard and Reports layouts at all five widths with actual staging content, and screen-reader/touch behaviour.
6. DBA should confirm the deployed schema/RLS matches the checked-in baseline. There is no new SQL requiring application. Business owners should confirm that completed participation is the desired meaning of Completed Events; exact unique corporate volunteer counts and deleted individual cancellation history are unavailable in the current schema.

## Visual consistency follow-up

Only `ReportCharts.tsx`, `Reports.module.css`, `DashboardAnalytics.tsx`, the isolated visual fixture generator and this handoff were changed in the styling pass. No reporting calculations, filters, CSV, authentication, queries, SQL, dependencies or unrelated page styles changed.

The Dashboard, Events, Volunteer Rosters, Corporate CSR, shared controls and admin stylesheet were inspected. Shared surfaces are white / #1a2530; page backgrounds are #f6f7f9 / #111820; card radius is 10px, statistic padding 18px, header spacing 20px 24px, body spacing 24px (16px mobile), statistic value 28px/800. Existing 1050px and 760px responsive conventions are retained. Chart-only CSS variables mirror existing admin palette values because that stylesheet has no shared colour variables. All general card/control styles come directly from the existing classes.

In the isolated browser comparison, report statistic backgrounds, borders, radii, shadows, padding, font families, label/value/note colours, sizes and weights matched the actual dashboard's computed styles. Both themes were checked at 375, 768 and 1440px. Reports and the new dashboard preview had no page overflow when the pre-existing dashboard table was isolated. The unchanged dashboard grid's 720px minimum table causes baseline overflow at 375/768px; it was not modified in this visual-only scope. Authenticated staging visual comparison remains outstanding.
