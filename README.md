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

- Account registration, sign-in and password recovery
- Event browsing, shift bookings and cancellation
- QR attendance scanning and manual attendance-code entry
- Profile management, volunteering history and recorded hours
- Participation certificates for eligible verified attendance
- In-app notifications and personal shift-reminder preferences

### Admin portal

- Dashboard with upcoming events, bookings and participation information
- Event and timeslot management
- Volunteer rosters and attendance information
- Corporate company and group-booking management
- Filtered analytics, event performance, attendance heatmaps and CSV exports
- Administrator access, notification preferences and recent admin/WMS activity

### WMS integration

The API base path is `/api/integrations/wms/v1`. It supports health checks, event/timeslot publishing, capacity updates, booking retrieval and attendance updates. Requests require the configured WMS bearer token. Integration routes use a server-only database credential.

### Corporate portal and volunteer directory

The real app includes business registration/sign-in, verified-email account approval, corporate-only events, group-booking requests, external-payment deadlines and confirmation, amendments/cancellation, notifications with links, status history, group attendance and CSV/print reports. Administrators can search all volunteer profiles under **Volunteer directory**, see email/cellphone details and use email/call links.

Corporate screens are visible by default. The optional `NEXT_PUBLIC_CORPORATE_ROLLOUT_ENABLED`, `NEXT_PUBLIC_CORPORATE_BOOKINGS_ENABLED`, `NEXT_PUBLIC_CORPORATE_CHANGES_ENABLED` and `NEXT_PUBLIC_CORPORATE_OUTCOMES_ENABLED` switches disable their stages only when explicitly set to `false`. They are not authorization controls.

The four additive corporate migrations are in `supabase/migrations/`. They extend the existing VMS schema; this repository does not contain its full historical baseline. A Next.js/Vercel deployment does not apply SQL. Keep `corporate_private` outside exposed Data API schemas. Review migration history with the database maintainer rather than blindly running `supabase db push`.

Administrator setup:

1. **Corporate accounts → Access settings:** manage registration and cellphone enforcement. Enable database phone enforcement after deploying the updated signup/profile forms; missing numbers block new bookings, not attendance/cancellation.
2. **Corporate bookings → Booking settings:** enter the actual booking-team email and phone, then open requests. Both are required; no contact details or activity prices are invented.
3. **Corporate events:** create and publish actual available dates, times, capacities and group limits. No preset activity menu is required.
4. Approve verified business accounts, review booking requests and set payment deadlines. Requests hold no places; acceptance atomically reserves the group. Overdue bookings are flagged, not automatically cancelled.
5. Record verified external payments to confirm bookings. Payment/refund discussions stay outside the portal; no money is processed.
6. Review changes/cancellations and, after the event ends, record actual attendance and optional combined group hours. Corrections retain earlier totals and receipts. Reports load the full filtered scope, not only the visible page.

Configure Supabase Auth email confirmation, SMTP delivery and permitted verification/recovery redirect URLs for each deployment. Built-in Supabase email delivery is limited; public registration needs a suitable email provider. Do not add SMTP credentials or service-role keys to browser code. Google sign-in uses the configured Supabase provider; existing volunteers can add business membership without losing individual bookings.

Corporate events/reservations are separate from volunteer events, WMS timeslots and legacy CSR records. Existing CSR data remains available as **Legacy CSR history**. Company ownership and admin decisions are enforced by RLS and checked functions, not by client-supplied roles.

`design-preview/` remains a separate, fictional mockup; it is not used by the real app. Automated tests cover isolated PostgreSQL workflows/permissions, components and WMS regressions. Real inbox delivery, browser/mobile/print checks and live WMS acceptance still need human verification before production sign-off.

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
design-preview/     Standalone HTML/JavaScript design prototypes
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

Run the corporate preview tests:

```bash
node --test tests/corporate-preview.test.mjs
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

Automatic in-app reminders depend on the database reminder function and scheduled job. The application currently uses 24-hour and 2-hour reminders checked every five minutes when enabled. Email, SMS and mobile push delivery are not implemented by those reminder settings.

## Security and data handling

- Keep credentials and real volunteer details out of recordings, screenshots and source control.
- Authorisation must be enforced through database permissions/policies and server-side checks, not only navigation or hidden buttons.
- Use isolated test data for development and integration tests where possible.
- Treat prototype role-switching controls as demonstration tools only; they must not become production access controls.
- Coordinate schema changes, production deployment and integration sign-off with the responsible Ladles and WMS teams.
