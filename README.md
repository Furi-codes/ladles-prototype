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

### Design previews

`design-preview/` contains standalone HTML previews. The corporate workflow mockup simulates business registration, account approval, booking requests, external-payment deadlines, overdue flags, amendments, notifications and a searchable volunteer directory.

These new workflows are prototypes, not evidence that the corresponding production features have been implemented. The corporate preview uses fictional in-memory data and resets on refresh. It does not create real accounts, send messages or process payments.

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

The repository expects an existing Supabase schema, policies and database functions. Installing npm dependencies does not create them. Database setup scripts are not included in this repository; coordinate database configuration with the database maintainer.

## Project structure

```text
app/
  components/       Shared interface and authentication components
  admin/            Admin pages, components and styles
  volunteer/        Volunteer pages, components and styles
  api/              Server-side API routes, including WMS integration
lib/
  actions/          Data-access functions
  server/           Server-side integration helpers
  types.ts          Shared TypeScript models
  ...               Reporting, date, attendance and pagination utilities
tests/              Automated logic, component and mocked route tests
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

The suite includes unit tests for shared logic and tests of components/API routes using controlled mocks. Passing these checks does not replace browser acceptance testing, database tests or live WMS end-to-end testing. SQL test files require a suitable database test environment and should be reviewed before execution.

There is currently no `npm test` script; use the Node commands above. Keeping tests in the repository does not automatically configure GitHub Actions.

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
