# Ladles of Love Volunteer Management System

A volunteer-management web application for Ladles of Love. Volunteers can book shifts, record attendance and review their participation. Administrators manage events, rosters, corporate records, analytics and settings. The application also exposes an authenticated integration API for the Warehouse Management System (WMS).

## Technology stack

- Next.js 16 and React 19
- TypeScript
- Supabase Authentication and PostgreSQL
- CSS Modules and shared portal styles
- Node.js test runner and ESLint
- Vercel hosting

## Features

### Volunteer portal

- Account registration, sign-in, password recovery and password changes
- Event browsing, shift bookings and cancellation
- QR attendance scanning and manual attendance-code entry
- Profile management, volunteering history and recorded hours
- Participation certificates for eligible verified attendance
- In-app notifications and separate personal 24-hour / 2-hour shift-reminder preferences

Volunteer cellphone numbers are optional at registration and in the profile. When provided, their format is validated; clearing a number stores `NULL`.

### Admin portal

- Dashboard with upcoming events, bookings and participation information
- Event and timeslot management
- Volunteer rosters and attendance information
- Corporate company and group-booking management
- Filtered analytics, event performance, attendance heatmaps and CSV exports
- Administrator access, portal contacts, account settings and recent admin/WMS activity

### WMS integration

The API base path is `/api/integrations/wms/v1`. It supports health checks, event/timeslot publishing, capacity updates, booking retrieval and attendance updates. Requests require the configured WMS bearer token. Integration routes use a server-only database credential.

### Corporate portal and volunteer directory

The real app includes business registration/sign-in, verified-email account approval, corporate-only events, group-booking requests, external-payment deadlines and confirmation, amendments/cancellation, notifications with links, status history, group attendance and CSV/print reports. Administrators can search all volunteer profiles under **Volunteer directory**, see email/cellphone details and use email/call links.

Corporate screens are visible by default. The optional `NEXT_PUBLIC_CORPORATE_ROLLOUT_ENABLED`, `NEXT_PUBLIC_CORPORATE_BOOKINGS_ENABLED`, `NEXT_PUBLIC_CORPORATE_CHANGES_ENABLED` and `NEXT_PUBLIC_CORPORATE_OUTCOMES_ENABLED` switches disable their stages only when explicitly set to `false`. They are not authorization controls.

The additive corporate migrations are in `supabase/migrations/`. They extend the existing VMS schema; this repository does not contain its full historical baseline. A Next.js/Vercel deployment does not apply SQL. Keep `corporate_private` outside exposed Data API schemas. Review migration history with the database maintainer rather than blindly running `supabase db push`.

Administrator setup:

1. **Corporate accounts → Access settings:** open or close new business registration. Existing accounts and bookings remain available when registration is closed.
2. **Admin Settings → Portal contacts:** configure the actual support contacts separately for volunteers and companies. Corporate requests require a primary email and phone. Then open requests under **Corporate bookings → Booking settings**. No contacts or activity prices are invented. Both portals show a header contact button with Copy and optional email/call actions.
3. **Corporate events:** save drafts or publish actual sessions with a date/time, location and one maximum group size. The calendar labels available, reserved, unpublished, cancelled and past sessions. No preset activity menu is required.
4. Approve verified business accounts, review booking requests and set payment deadlines. Requests reserve nothing; acceptance atomically reserves the entire session for one company and rejects competing requests with notifications. Overdue bookings retain the reservation until an admin acts.
5. Record verified external payments to confirm bookings. Payment/refund discussions stay outside the portal; no money is processed.
6. Use **Corporate bookings → Attendance** for confirmed sessions that have ended and still need attendance. **Record attendance** opens the form directly; resolve any outstanding change/cancellation request first. The admin bell also receives an in-app follow-up from a five-minute database job, with one reminder per booking/session end. Resolved reminders leave the outstanding inbox without deleting their stored history. Attendance is never recorded automatically. Record actual attendees and optional whole event hours (12 people attending a two-hour event records 2 hours, not 24). Unknown hours remain blank; zero is explicit. Corrections retain earlier totals and receipts. Completed-booking reports, CSV and printing use the same event-duration values and load the full filtered scope, not only the visible page.
7. Use the admin notification bell for account and booking updates, unread counts and links to the affected records. Contact controls reveal email/phone details before offering Copy or optional email/calling-app actions. Corporate analytics has its own admin sidebar page, separate from volunteer analytics.

Configure Supabase Auth email confirmation, SMTP delivery and permitted verification/recovery redirect URLs for each deployment. Built-in Supabase email delivery is limited; public registration needs a suitable email provider. Do not add SMTP credentials or service-role keys to browser code. Google sign-in uses the configured Supabase provider. Volunteer and business accounts are separate: someone using both needs different email addresses. One sign-in screen routes each account to its own portal; a volunteer login cannot be converted into a business account.

Corporate events/reservations are separate from volunteer events, WMS timeslots and legacy CSR records. The old Legacy CSR history page has been removed; historical database records are preserved. Company ownership and admin decisions are enforced by RLS and checked functions, not by client-supplied roles.

SMTP supplies Auth verification and password-recovery email delivery only. Booking, approval, payment, change and cancellation updates remain in-app; configuring SMTP does not add operational booking emails. Before release, verify the real booking-team contact details, SMTP sender, allowed redirect URLs and inbox delivery. Expired verification links offer a resend action; expired recovery links offer a new password-reset request.

Personal notification preferences live in **Volunteer Profile** and **Business profile**, with independent 24-hour and 2-hour reminder switches. Both, either or neither can be enabled. Existing volunteer opt-outs remain off. Corporate session reminders apply to confirmed future bookings for approved companies. Turning a reminder off marks existing messages of that type read without deleting history; booking decisions, payment updates and cancellations remain enabled. There is no admin-wide reminder switch. Late bookings receive only the next applicable enabled threshold, not a missed 24-hour reminder shortly before the session.

Automated tests cover isolated PostgreSQL workflows/permissions, application components and WMS regressions. Email delivery and deployed integrations also require checks against the configured services.

New passwords require 8–128 characters, an uppercase letter, a lowercase letter, a number and a symbol. These requirements apply to registration and password changes/resets; existing passwords remain usable for sign-in. Password changes are available in Admin Settings → My account, Volunteer My profile and Corporate Business profile, and require the current password. The password policy is also declared in `supabase/config.toml`; a Vercel deployment does not apply Supabase configuration.

## Local setup

### Requirements

- Node.js 20.9 or later; use a supported LTS release compatible with the dependencies
- npm
- Access to the configured Supabase project and its existing database schema

### Install dependencies

From the project root:

```bash
npm ci
```

### Configure environment variables

Create `.env.local` in the project root using values supplied by the project administrator:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key

# Server-only: required for WMS integration
WMS_INTEGRATION_TOKEN=your-shared-integration-token
SUPABASE_SECRET_KEY=your-server-secret-key
```

The integration also accepts `SUPABASE_SERVICE_ROLE_KEY` as a fallback when `SUPABASE_SECRET_KEY` is absent. Use the appropriate server credential for the configured project.

Never commit `.env.local`, paste actual credentials into this README, or give server secrets a `NEXT_PUBLIC_` prefix. Public configuration is included in browser code; secret/service-role credentials must remain server-side.

### Start development

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). The entry page is `app/page.tsx`. Admin and volunteer access depend on the authenticated user's profile role; registering a volunteer does not grant administrator access.

The repository expects an existing Supabase schema, policies and database functions. Installing npm dependencies does not create them. The new `supabase/migrations/` folder contains only the corporate rollout additions, not the historical schema; coordinate application and migration baselining with the database maintainer.

## Project structure

```text
app/
  components/       Shared interface and authentication components
  admin/            Admin pages, components and styles
  volunteer/        Volunteer pages, components and styles
  corporate/        Corporate account, event, booking and report workspace
  api/              Server-side API routes, including WMS integration
lib/
  actions/          Data-access functions
  server/           Server-side integration helpers
  types.ts          Shared TypeScript models
  ...               Reporting, date, attendance and pagination utilities
tests/              Logic, component, mocked route and isolated PostgreSQL tests
supabase/migrations/ Additive corporate rollout SQL (not automatically applied)
public/             Static assets
```

## Tests and code checks

Run the JavaScript test suite:

```bash
node --test tests/*.test.mjs
```

Run only the WMS route tests:

```bash
node --test tests/wms-integration.test.mjs
```

Check code style and TypeScript:

```bash
npm run lint
npx tsc --noEmit
```

The suite includes unit tests for shared logic, tests of components/API routes using controlled mocks, and corporate migration/RLS/workflow tests in an isolated in-memory PostgreSQL instance (`@electric-sql/pglite`). These tests do not use hosted credentials or change the live database. Passing them does not replace browser acceptance testing, full-schema staging tests, separate-connection concurrency tests or live WMS end-to-end testing. Any other SQL test scripts must be reviewed before execution.

Use `npm test` to run the complete suite. Keeping tests in the repository does not automatically configure GitHub Actions.

## Production build and deployment

```bash
npm run build
npm run start
```

For Vercel, configure the required environment variables for the intended deployment environment. The deployment must point to the correct Supabase project, with appropriate authentication redirect URLs, database permissions and policies. Redeploy after changing build-time public environment variables.

Automatic in-app reminders depend on database functions and scheduled jobs. Volunteer shifts and corporate sessions are checked every five minutes using each account's personal 24-hour and 2-hour preferences. Admin attendance follow-ups run separately and are unaffected by these choices. Email, SMS and mobile push delivery are not implemented by those reminder settings.

## Security and data handling

- Keep credentials and real volunteer details out of recordings, screenshots and source control.
- Authorisation must be enforced through database permissions/policies and server-side checks, not only navigation or hidden buttons.
- Use isolated test data for development and integration tests where possible.
- Coordinate schema changes, production deployment and integration sign-off with the responsible Ladles and WMS teams.
