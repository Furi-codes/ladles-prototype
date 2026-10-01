# Ladles of Love design rollout

Visual reference: `design-preview/index.html`. Sample data belongs only in the preview.
User approved implementation in focused parts. Part 1 requested 30 September 2026.

## Part 1 — shared design and navigation

- [x] Portal-scoped colour, typography, radius, spacing and motion foundation.
- [x] Light/dark theme tokens; common cards, buttons, inputs and focus states.
- [x] Slimmer admin sidebar, grouped existing routes, breadcrumb and compact account header.
- [x] Volunteer desktop links and mobile bottom bar: Home, My impact, Attendance, Profile.
- [x] Mobile account menu retains theme and sign-out controls.
- [x] Keyboard menu focus/escape handling, body scroll lock, responsive closing, skip links.
- [x] Safe-area spacing and hide navigation in printed reports.
- [x] ESLint and production build (including TypeScript) passed; `git diff --check` clean.
- [ ] User desktop/mobile visual review (connected browser unavailable last session).

## Part 2 — admin dashboard and analytics

- [x] Compact dashboard impact chart and summary; volunteer graph untouched.
- [x] Analytics toolbar, keyboard-accessible tabs, four compact metrics and responsive side-by-side charts.
- [x] Monthly participation, programme hours, weekday/shift heatmap and event booking/attendance comparison.
- [x] One shared date/event/location/corporate/company scope for charts, metrics, event table and CSV.
- [x] Period unique volunteers deduplicated; corporate attendance clearly labelled as instances.
- [x] Cancelled events/groups excluded; zero months, empty/error states, open attendance records and missing heatmap slots handled.
- [x] Existing authorised, paginated report loader reused; no SQL, permissions or integration-route changes.
- [x] Calculation/pagination test suite (16 tests), TypeScript, ESLint and production build passed.
- [ ] User visual review on desktop/mobile and live-data spot-check (browser unavailable).

Follow-up implemented: volunteer mobile uses the bottom bar without a duplicate hamburger. Theme/sign-out controls are available near the top of Profile; sign-out reuses the shell's existing confirmation. Desktop header controls remain.

Reports follow-up: Event type filter covers Dignity Kitchen, Warehouse HQ, Feed The Soil, Campaign / Special Event and Other. Shared filtering applies to analytics, event performance, corporate impact and CSV. Missing legacy categories are treated as Other, matching the programme chart. Reset/preset selection clears the type filter. Calculation/pagination suite now contains 17 tests.

Analytics usability follow-up: the attendance heatmap now uses one column per selected event, labelled with its event date and name, and one row per shift start time. This replaces the ambiguous weekday/time aggregation, while preserving the same recorded-attendance values. The current report selection is displayed as labelled blocks for period, event type, location, event and participation (plus company when applicable).

## Remaining implementation

2. Analytics/dashboard: implemented locally; visual/live-data review still pending. All admin charts use event dates (volunteer RPC chart still uses clock-in months).
3. Reports/certificates: refine hours PDF and CSV; agree certificate eligibility (per event, cumulative hours, or both) and sponsor wording before issuance.
4. Volunteer experience: next shift, opportunities, booking detail, personal history and impact using actual user data.
5. Admin workflows: event/roster/CSR/settings polish; keep warehouse ownership in WMS.
6. Notifications/reminders: finish in-app centre; agree delivery channels and timing, then implement delivery, retry and duplicate prevention.
7. Combined QA/release: desktop/mobile, keyboard, reduced motion, print, data accuracy, access rules and integration retest.

## Handoff notes

### Manual attendance-code fallback (1 October 2026)

- Admin Events → Attendance QR codes now shows separate 10-character clock-in/out codes, copy/replace actions and printable sheets including QR and typed codes.
- Volunteers use Attendance → Enter code. QR scanning and direct checkpoint links remain supported; switching to code entry releases the camera.
- Additive SQL in `database/manual-attendance-codes.sql` is already applied to the connected Supabase project. No environment variables or additional SQL paste is needed there.
- Code entry delegates to existing attendance validation, preserving booking checks, time windows, duplicate protection, recorded minutes and WMS triggers. Ten code submissions per user per ten-minute window; admins alone can rotate codes. Old typed codes stop working after replacement; existing QR links do not change.
- Verified with rollback-only database tests (see `database/manual-attendance-codes.test.sql`), plus lint, TypeScript, production build and reporting tests. Signed-in browser, camera/mobile, clipboard and two-page print visual checks remain for user review. Application changes have not been pushed/deployed.
- Supabase security review: the new private attempt table deliberately has no client policies and denies direct client access. Separate existing findings include disabled RLS on `public.signups`, mutable search path on `handle_new_user`, publicly executable legacy definer functions and disabled leaked-password protection; no unrelated permissions were changed in this feature.

### Part 5 — admin management screens (1 October 2026)

- Events: search by name/location, programme filter, result counts, explicit ownership labels and a contained scrollable table; WMS controls and save/cancel/delete behaviour preserved.
- Rosters: volunteer name/email search, attendance status filter, matched/full counts and loading/error/retry states. Summary totals continue to describe the full selected event roster.
- Corporate CSR: relationship filtering, company/contact/industry search, selected-company contact summary, grouped company editing fields and clearer relationship notes.
- Group bookings: status filter, empty state, separate attendance/hours columns and labelled booking/participation form sections. Existing capacity and booking save actions preserved.
- Settings: section navigation, clearer preference controls and headings, contained activity table. Notification delivery remains a later phase, as explained in the existing preference text.
- No SQL or new data permissions. Browser visual review and live form smoke tests remain pending.

### Parts 3 and 4 follow-up (1 October 2026)

- Certificate is volunteer self-service on My impact, replacing the old participation printout. No admin certificate workflow. It opens the browser print / Save as PDF dialog.
- Part 4: personalised home greeting, next/in-progress shift banner, personal statistics, searchable opportunities with programme filter and remaining availability, and booking details linked to the scanner.
- My impact: compact personal totals, certificate preview and existing PDF action, attendance notes, and status-filtered history with incremental Show more.
- Uses existing volunteer data and actions. Dates for opportunity tiles are parsed explicitly as UTC dates to avoid day shifts; no schema or permission changes.
- Existing community chart retained as previously requested. Notifications/reminders and broader admin management remain later phases.
- Desktop/mobile browser visual review remains necessary; automated checks do not verify actual printing or live booking transactions.

- Earlier analytics work already exists. Preserve it when implementing Part 2; do not rebuild from the sample HTML's fabricated data.
- Part 1 changes presentation/navigation only; no schema changes, new role switching, sample production data or new auth routes.
- Do not add preview-only Certificates/Notifications destinations until real routes exist.
- Preview HTML remains standalone and is not in `public/`.
- Live WMS capacity retest is still separate from this design work; a build passing is not proof of database enforcement.
