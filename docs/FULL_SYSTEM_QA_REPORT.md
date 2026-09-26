# Full System QA Report

## 1. Environment and Branch

- Application: Ladles of Love Volunteer Management System
- Branch tested: `AmienBranch`
- Commit at start: `101667b` (`Improve reports and add admin access management`)
- Date tested: 2026-09-25
- Local build: Next.js 16.2.4, React 19.2.4, Node.js 24.15.0
- Supabase configuration: local `.env.local` was present, but no staging designation or disposable test-account credentials were available. The separate `env.local.txt` file was not used or modified.
- Safety: no migrations, SQL, RLS, database records, credentials, commits, pushes, or deployments were changed.
- Worktree: existing user/automation edits were present before QA. This report is the only file added by this QA pass.

## 2. Fixture and Account Strategy

No authenticated staging account or confirmed disposable Supabase project was available. The configured Supabase URL was therefore not used for mutating or authenticated tests. No real volunteer, admin, company, booking, attendance, settings, or event records were created or changed.

Executed fixture strategy:

- Existing repository tests use isolated TypeScript-transpiled mocks, controlled in-memory fixtures, and static migration/source assertions.
- The reports analytics tests use independently defined events, bookings, attendance, corporate bookings, companies, cancellation states, missing checkout values, and date boundaries.
- The existing visual fixture is explicitly isolated from Supabase and uses synthetic report data only.
- Browser checks used the local production build on port 3001. Port 3000 was already occupied and was left untouched.

## 3. Feature Results

| Area | Result | Evidence or blocker |
|---|---|---|
| Login page rendering and accessible controls | PASS | Local browser showed labelled email/password fields, Sign In, Google sign-in, password visibility, forgot-password text, and account creation entry point. |
| Password visibility control | PASS | Browser interaction changed the password input from `password` to `text` and button text from `SHOW` to `HIDE`. |
| Unauthenticated route protection | PASS | Local production browser redirected `/admin`, `/admin/reports`, `/admin/settings`, and `/volunteer` to `/`. |
| Login, logout, registration, reset completion, OAuth | BLOCKED | Requires disposable authenticated Supabase accounts, email delivery, and OAuth provider configuration. |
| Volunteer profile and consent onboarding | BLOCKED | Requires authenticated staging volunteer and database fixtures. |
| Volunteer event discovery and bookings | BLOCKED | Requires staging events, slots, RLS, booking RPCs, and disposable volunteer accounts. |
| Duplicate, full-capacity, past-slot, cancellation, concurrent booking behavior | BLOCKED live / PASS static contracts | Static migration and source tests cover intended validations; no live transaction or record test was run. |
| Attendance, QR/checkpoint, clock-out, no-show behavior | BLOCKED | Requires authenticated accounts, real QR/checkpoint data, camera permissions, and staging records. |
| Corporate companies, notes, bookings, status and capacity workflows | BLOCKED live / PASS static contracts | Static migration tests cover RPC validation and capacity rules; no live CSR records or concurrency test was run. |
| Corporate attendance and volunteer-hours validation | BLOCKED live / PASS static contracts | Static migration checks cover numeric/state constraints; live RPC behavior was not exercised. |
| Reports calculations, filters, cancellation rules, presets and CSV serialization | PASS in isolated tests | Reporting tests cover four summaries, monthly data, corporate status, inclusive dates, six presets, company/participation scope, empty data, cancellation exclusions, CSV escaping/formula neutralization, and pagination. |
| Authenticated report loading and real CSV download | BLOCKED | Requires admin staging session and controlled database fixtures. |
| Dashboard analytics and View Full Reports | BLOCKED authenticated / PASS static render coverage | Components and isolated visual fixture are covered; authenticated dashboard data/navigation were not tested. |
| Settings notification preferences | BLOCKED live / PASS source contract | Notification-only allowlist is covered by automated tests; persistence requires an admin staging session. |
| Organisation identity protection | PASS static / BLOCKED live | Identity guard and no-organisation-field payload assertions passed; live unauthorized API/RLS test was not run. |
| Admin grant/revoke UI and direct authorization | BLOCKED live / PASS static contract | RPC source checks cover non-admin denial, invalid target/role, self-revocation, and final-admin protection; live RLS/RPC calls were not run. |
| Themes, responsive login layout and basic accessibility | PASS limited | Login page had no horizontal overflow at 375, 430, 768, 1024, and 1440px; labels and button names were visible in the accessibility snapshot. Authenticated screens remain unverified. |

## 4. Executed Test Evidence

### Automated baseline and regression

Commands executed:

```text
npx tsc --noEmit                 PASS
npm run lint                     PASS
node --test <six test files>     PASS: 36 tests, 36 passed, 0 failed
npm run build                    PASS: 15 routes generated
git diff --check                 PASS
```

The test files covered access contracts, migration/security/capacity contracts, pagination, report loading authorization/error handling, report calculations, CSV output, date presets, cancellation exclusions, and analytics fixtures. No test wrote to Supabase.

### Local browser checks

The production build was started with `PORT=3001 npm run start`.

- `/`: login UI rendered successfully.
- `/admin/reports`, `/admin/settings`, `/admin`, and `/volunteer`: unauthenticated requests settled on `/`.
- Password visibility interaction succeeded.
- Login document `scrollWidth` equalled viewport width at 375, 430, 768, 1024, and 1440 pixels.
- The first browser interaction attempt timed out after rapid viewport changes; the isolated retry succeeded with `force: true`. This was a harness stabilization issue, not reported as an application defect.

No authenticated browser session, real CSV file, QR scan, email flow, or Supabase mutation was executed.

## 5. Bugs and Risks

### Existing responsive risk: dashboard table minimum width

- Severity: Medium, authenticated mobile usability risk
- Status: Not fixed in this QA pass
- Evidence: existing visual handoff identifies the dashboard table's `min-width: 720px` as causing baseline horizontal overflow at narrow widths. The login page itself did not overflow in the executed browser check.
- Reproduction: authenticate as an admin, open `/admin` at approximately 375px or 768px, and inspect the dashboard table width. Confirm whether the table wrapper provides the intended usable horizontal scroll rather than page-level overflow.
- Recommended follow-up: execute this with authenticated staging content before release and adjust only if the overflow is confirmed as page-level or obstructs core controls.

### Authorization verification gap

- Severity: High release-readiness gap, not a reproduced defect
- Status: Blocked by unavailable staging accounts/environment
- Risk: client-side route guards are not a substitute for Supabase RLS and RPC authorization. Live anonymous, volunteer, admin, direct REST, self-revocation, final-admin, and corporate-data denial checks remain necessary.

No new application bug was reproduced by the executable checks in this pass.

## 6. Files Changed and Fixes Applied

This QA pass added only:

- `docs/FULL_SYSTEM_QA_REPORT.md`

No application code, migrations, tests, configuration, database schema, RLS policy, or environment file was changed during this QA pass. Existing working-tree changes were preserved.

## 7. Automated Test Results

- TypeScript: PASS
- ESLint: PASS with no reported errors
- Repository tests: PASS, 36/36
- Production build: PASS, 15 routes generated
- Diff whitespace check: PASS
- Database execution: NOT RUN
- Live concurrency: NOT RUN

## 8. Browser Test Results

Local unauthenticated browser coverage passed for login rendering, route redirects, password visibility, accessibility snapshot text, and five viewport widths. Authenticated admin/volunteer browser coverage is BLOCKED by unavailable staging credentials and a confirmed disposable environment.

## 9. Database Authorization and Concurrency

No live database authorization or concurrency test was performed. This was intentional because the available configuration was not confirmed as staging and the safety rules prohibit destructive or potentially real-record workflows.

Static checks passed for:

- Admin RPC search and mutation contract shape.
- Non-admin denial, invalid target/role rejection, self-revocation rejection, and final-admin protection in migration source.
- Corporate RPC authentication/grant and capacity validation contracts.
- Report admin-check denial and query-error propagation.
- Settings notification allowlist and exclusion of removed organisation fields.

Required staging tests remain: anonymous/volunteer/admin RLS reads and writes, direct table mutation denial, RPC execution, profile role protection, shared individual/corporate capacity races, opposite slot moves, cancellation release, completed-history protection, and sequence/grant checks.

## 10. Responsive and Accessibility Findings

Observed locally:

- Login controls had named labels and meaningful accessible button names.
- Login page had no horizontal overflow at 375, 430, 768, 1024, or 1440 pixels.
- Password visibility state was exposed through the button text change.

Not tested: authenticated page layouts, chart keyboard/touch behavior with live data, screen-reader traversal across tables and dialogs, camera permissions, focus restoration, dark/light comparison in authenticated routes, and actual CSV download inspection.

## 11. Remaining Manual Tests and Risks

Before release, use a disposable staging project with separate anonymous, volunteer, admin, second-admin, and test corporate accounts. Execute the staging checklist for auth, events, bookings, attendance, QR, CSR, reports, settings, admin access, RLS, concurrency, responsive layouts, and CSV files. Reconcile report cards and charts against independently calculated fixture totals. Confirm no migration is reapplied and no production records are touched.

The highest remaining risk is not covered by local unit/static tests: whether the deployed database schema, RLS policies, function grants, API schema cache, and transaction behavior match the checked-in assumptions.

## 12. Release-Readiness Checklist

- [x] Correct branch identified: `AmienBranch`
- [x] Existing baseline failures recorded: none in TypeScript, lint, tests, build, or diff check
- [x] No migrations or schema changes executed
- [x] No production records modified
- [x] No credentials or service-role keys exposed
- [x] Automated regression suite passed
- [x] Local unauthenticated browser smoke checks passed
- [ ] Disposable staging environment confirmed
- [ ] Authenticated volunteer/admin browser regression complete
- [ ] Live RLS and RPC authorization complete
- [ ] Live capacity/concurrency tests complete
- [ ] Live QR, attendance, email, OAuth, and no-show tests complete
- [ ] Authenticated responsive/accessibility review complete
- [ ] Real filtered CSV files inspected
- [ ] Dashboard mobile table risk resolved or explicitly accepted

**Release recommendation:** Not release-ready based on this QA pass alone. The code/build/test baseline is green, but the required authenticated staging, database authorization, concurrency, and real-record workflow evidence is unavailable and therefore remains BLOCKED rather than inferred as passing.