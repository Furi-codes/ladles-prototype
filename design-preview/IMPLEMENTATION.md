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

## Remaining implementation

2. Analytics/dashboard: refine current draft charts and statistics; verify real data, filters, metric definitions, empty/error states and mobile layout.
3. Reports/certificates: refine hours PDF and CSV; agree certificate eligibility (per event, cumulative hours, or both) and sponsor wording before issuance.
4. Volunteer experience: next shift, opportunities, booking detail, personal history and impact using actual user data.
5. Admin workflows: event/roster/CSR/settings polish; keep warehouse ownership in WMS.
6. Notifications/reminders: finish in-app centre; agree delivery channels and timing, then implement delivery, retry and duplicate prevention.
7. Combined QA/release: desktop/mobile, keyboard, reduced motion, print, data accuracy, access rules and integration retest.

## Handoff notes

- Earlier analytics work already exists. Preserve it when implementing Part 2; do not rebuild from the sample HTML's fabricated data.
- Part 1 changes presentation/navigation only; no schema changes, new role switching, sample production data or new auth routes.
- Do not add preview-only Certificates/Notifications destinations until real routes exist.
- Preview HTML remains standalone and is not in `public/`.
- Live WMS capacity retest is still separate from this design work; a build passing is not proof of database enforcement.
