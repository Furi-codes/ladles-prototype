# Ladles of Love Volunteer Management System

A web application for managing individual volunteering and corporate group bookings at Ladles of Love. It includes volunteer, corporate and administrator portals, with an API for the Warehouse Management System (WMS).

## Technology stack

- Next.js 16, React 19 and TypeScript
- Supabase Authentication and PostgreSQL
- CSS Modules and shared portal styles
- Node.js test runner, PGlite and ESLint
- Vercel hosting

## Main features

- **Volunteers:** registration, shift bookings, QR/code attendance, recorded hours, certificates and profile management.
- **Corporate accounts:** business registration and approval, exclusive-session booking requests, payment deadlines, changes, cancellations and group reports.
- **Administrators:** event management, volunteer directory and rosters, account approvals, attendance, analytics, portal contacts and activity history.
- **Notifications:** in-app updates and personal 24-hour and 2-hour reminder preferences.
- **WMS integration:** authenticated event publishing, capacity updates, booking retrieval and attendance synchronisation.

Payments are arranged externally; the portal records admin confirmation. Volunteer and business accounts use separate email addresses.

## Getting started

### Requirements

- Node.js 20.9 or later
- npm
- Access to the existing Supabase project and database schema

### Installation

```bash
npm ci
```

### Environment variables

Create `.env.local` in the project root:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key

# Server-only: required for WMS integration
WMS_INTEGRATION_TOKEN=your-shared-integration-token
SUPABASE_SECRET_KEY=your-server-secret-key
```

`SUPABASE_SERVICE_ROLE_KEY` is supported as a fallback for `SUPABASE_SECRET_KEY`. Never commit credentials or expose server secrets through `NEXT_PUBLIC_` variables.

### Database and authentication

The app requires the existing Supabase tables, permissions and database functions. `supabase/migrations/` contains additive migrations, not a complete database baseline. Coordinate migration setup with the database maintainer before using a new project.

Configure authentication redirect URLs and SMTP for email verification and password recovery. Booking and payment updates remain in-app. Automatic reminders and attendance follow-ups also require the database's scheduled jobs.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Administrator access must be assigned through the authorised account-management process.

## Project structure

```text
app/          Next.js routes, layouts and API endpoints
features/     Auth, admin, volunteer and corporate functionality
components/   Reusable interface components
hooks/        Shared React hooks
lib/          Shared data, validation and integration utilities
styles/       Global theme and shared portal styles
tests/        Automated tests and database fixtures
supabase/     Database migrations and authentication configuration
public/       Static assets
```

Features are grouped into folders such as `bookings/`, `events/` and `profile/`. Data-access functions live in `services/`; these are browser helpers, not Next.js Server Actions. Internal imports use the `@/` alias.

## Tests and checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests cover shared logic, components, API routes and database workflows. Database tests use isolated PGlite fixtures and do not change the live database.

## Deployment

Deploy to Vercel with the required environment variables, or run the production build locally:

```bash
npm run build
npm start
```

Before deploying, confirm database compatibility, Supabase redirect URLs, SMTP and the booking-team contacts configured in Admin Settings. Vercel deployments do not apply database migrations or `supabase/config.toml`; Supabase changes are managed separately.
