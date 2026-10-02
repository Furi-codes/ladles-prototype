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
3. Reports/certificates: volunteer self-service certificate and filtered CSV implemented; actual PDF/print review remains.
4. Volunteer experience: opportunities, booking details, personal statistics, history and impact implemented. Requested next-shift/contribution banners were removed.
5. Admin workflows: event/roster/CSR/settings polish implemented; staging and live form review remain. Warehouse ownership stays in WMS.
6. Notifications/reminders: in-app centre and scheduled 24-hour/2-hour reminders implemented; browser review remains. Email/SMS delivery is not configured.
7. Combined QA/release: desktop/mobile, keyboard, reduced motion, print, data accuracy, access rules and integration retest.

## Handoff notes

### Personal notification preference and delivery verification (1 October 2026)

- Profile → Notification preferences has an automatically saved Shift reminder notifications on/off switch; inbox links directly to it. The switch controls optional in-app reminders only. Critical cancellation notices remain mandatory and visible, with this exception explained beside the control.
- Applied `volunteer_personal_reminder_preferences` to Supabase. New own-row-only `volunteer_notification_preferences` table and invoker save RPC avoid changing profile/role permissions. Missing preference means enabled. Opt-out marks old reminders read without deleting history.
- Scheduler now requires both the organisation reminder switch and the volunteer preference. Other volunteers' reminders are unaffected. Current settings screenshot's three future-delivery switches remain stored-only; email, SMS and OS/browser push are not connected.
- Verified live: job active every five minutes, five recent scheduled runs succeeded, notification publication enabled and a real 24-hour reminder exists. Success status alone is not a delivery count. Re-ran reminder/RLS checks against the updated function and rollback-tested personal opt-out/in, both thresholds, isolation from other users, read-state cleanup and mandatory cancellation delivery. No test preference changes committed. Security advisor returned no personal-preference-specific findings.
- Build, TypeScript, lint and 20 local tests passed. No connected browser was available for signed-in UI/realtime testing, so full browser end-to-end operation is not claimed. UI changes still need deployment and a signed-in Profile-toggle/reload and bell/inbox check.
- SQL references: `database/volunteer-notification-preferences.sql` and rollback tests in `database/volunteer-notification-preferences.test.sql`. Already applied to this project; no SQL paste or new environment variables needed.

### Reference-inspired UI polish (2 October 2026)

- Admin and volunteer top bars now stay sticky when scrolling; fixed later style overrides that reset them to relative positioning.
- Redesigned login/sign-up/recovery presentation with a responsive Ladles welcome panel, original bowl/heart SVG, clear mode controls, labelled autofill-ready fields, accessible native buttons, light/dark styling and reduced-motion-aware transitions. Existing Supabase calls and role routing preserved; no database changes.
- Inspiration and proposed next improvements: `docs/UI_INSPIRATION.md`. Based on sampled frames from the provided videos, with no borrowed artwork or fabricated metrics.
- No connected browser was exposed for visual/live-auth testing. No push/deploy performed.

### Part 7 — first local regression pass (1 October 2026)

- Fixed event expiry and attendance-time display to consistently use Africa/Johannesburg, including UTC date boundaries.
- Home statistics and the self-service certificate now share finalised completed-attendance totals; missing/invalid timestamps and negative/non-finite minutes are excluded.
- Booking submission catches failures, releases loading state, guards repeated submissions and rechecks the selected shift. Dialog focus no longer resets on parent refresh; background scrolling is restored on close. Home/inbox dialogs use the latest event data.
- Scoped certificate print visibility to certificate printing, added a print failure message and wrapping for long volunteer names/history text.
- Added four volunteer-workflow regressions. All 24 local tests and production build passed; signed-in browser/mobile, actual QR/code transactions, PDF visual review and deployed WMS tests remain separate checks.
- Full remaining manual/release checklist: `docs/RELEASE_CHECKLIST.md`. This is the first QA pass, not a claim that Part 7 is fully complete. No push/deploy or database changes in this pass.

### WMS ownership-trigger repair (1 October 2026)

- Applied `fix_wms_ownership_trigger_row_handling` to Supabase. Reference SQL: `database/fix-wms-ownership-trigger.sql`.
- Separate table-specific branches prevent reading a timeslot field from an event row. BEFORE UPDATE now returns NEW; BEFORE DELETE returns OLD. Existing ownership rule and permissions remain unchanged.
- Rollback-only tests verified VMS event create/edit/delete, slot capacity updates, event cancellation with volunteer notification, rejection of signed-in portal edits/deletes of WMS-owned records, and persistence of unsigned server WMS updates. No test data remained committed.
- This resolves the pre-existing cancellation/edit blocker recorded in Part 6 below. Reminder tests now exercise actual event cancellation rather than an already-cancelled fixture. Browser/API end-to-end retests remain distinct from SQL regression checks.

### Part 6 — notifications and in-app reminders (1 October 2026)

- Volunteer header has a notification bell and unread count on desktop/mobile without changing the bottom navigation. The home screen has a compact unread summary; the dedicated inbox is `/volunteer/notifications`.
- Unread/All filters, dated messages in Africa/Johannesburg, incremental Show more, Mark read/Mark all read, read history, booked-shift details and cancellation alternatives. Independent inbox errors/retry do not break volunteer bookings. Loading uses paginated queries scoped to the signed-in user.
- Supabase notifications publication enabled; filtered realtime subscription, focus refresh and a one-minute visible-page fallback. Latest-request tracking prevents older loads replacing newer results.
- Applied migrations `in_app_notifications_and_shift_reminders` and `enable_in_app_shift_reminders`; SQL references in `database/in-app-notifications.sql` and `database/enable-in-app-reminders.sql`. No environment variables or SQL paste needed for this connected project.
- Supabase Cron job `vms-in-app-shift-reminders` runs every five minutes. New reminders are enabled via the existing organisation setting. It creates one reminder when a confirmed shift enters the 24-hour window (>2 hours away), and another within 2 hours; late bookings/job retries catch up to the applicable window, never after the start. It skips cancelled events and non-confirmed bookings. Schedule changes can replace reminder details; unchanged schedules do not reset read state. Stale reminders become read but remain in history.
- Client grants allow SELECT under existing RLS and UPDATE only on `is_read`; clients cannot forge recipient/message/schedule or invoke the private invoker scheduler. Existing event-cancellation notification generation is unchanged.
- Email, SMS, browser push and booking-confirmation delivery are not implemented. Other preference switches are labelled future delivery; shift reminder switch now controls the in-app scheduler.
- Verification: rollback-only reminder/access checks, successful scheduled cron run, no new notification-specific security-advisor findings, 20 local tests, lint, TypeScript and production build passed. Browser/mobile interaction and realtime subscription delivery still require review. App changes have not been pushed/deployed.
- Separate pre-existing blocker discovered during cancellation testing: `public.prevent_wms_owned_record_changes()` refers to `old.external_timeslot_id` when triggered on `events`, causing an undefined-field error for signed-in callers. It also returns OLD for UPDATE, silently preserving old values for unsigned callers. The cancelled-event reminder fixture was inserted already cancelled; a real admin cancellation test is NOT claimed to pass. Repair/retest this ownership trigger separately before release.

### Legacy signups cleanup (1 October 2026)

- Removed unused `public.signups` from the connected Supabase project after confirming it contained zero rows and no application/function/view/foreign-key/trigger dependencies were found.
- Applied migration `remove_unused_legacy_signups`; SQL reference: `database/remove-legacy-signups.sql`. The migration locks the exact table, refuses removal if it contains data and uses DROP RESTRICT (no cascade).
- Verified the table is absent, its security-advisor warning is gone, and `auth.users`, `profiles`, `bookings` and `event_slots` remain. No stored signup data was deleted because the legacy table was empty. Other security-advisor findings remain separate from this cleanup.

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
