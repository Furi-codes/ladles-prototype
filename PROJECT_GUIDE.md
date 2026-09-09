# Ladles of Love Project Guide

This document is the “start here” file for the project. It is written for someone who knows nothing about the codebase, and it is meant to help you understand both the business purpose of the app and how the code is structured so you can confidently explain it in a demo or handoff.

This repo is a Next.js app for a volunteer coordination system used by a nonprofit called Ladles of Love. The app manages:

- volunteer sign-in and role-based access
- event creation and management by admins
- volunteer booking for events and time slots
- attendance tracking
- basic user profile management and password reset flows

At a high level, the app is a scheduling and operations tool for volunteers who help run community events.

---

## 1) What the project actually does

The project is not a generic starter app. It is a working prototype for a volunteer management workflow.

The app has two major user paths:

1. Volunteer path
   - User signs in or creates an account
   - User is assigned the `volunteer` role
   - User sees a calendar of community events
   - User can choose a time slot and sign up for an event
   - User can cancel a booking
   - User can see their own bookings and progress

2. Admin path
   - A user with the `admin` role logs in
   - They see an admin dashboard with metrics and live bookings
   - They can create, edit, and delete events
   - They can view volunteer attendance and mark people as present
   - They can see all bookings and volunteers in the system

This is a role-based app: the same login system sends different people to different screens depending on whether their profile says `admin` or `volunteer`.

---

## 2) The app’s core idea

Think of the app as a small operations dashboard for a nonprofit.

The business workflow is:

- a program organizer creates activities or events
- volunteers sign up for specific time slots
- admins monitor and track attendance
- volunteers can see their own participation history

In other words, the app is a lightweight scheduling system for event staffing.

---

## 3) Technology stack

This project uses the following stack:

- Next.js 16
- React 19
- TypeScript
- Supabase for authentication and database
- `@supabase/supabase-js` for database access
- `react-calendar` for the calendar UI
- `moment` for date formatting and date logic
- inline styles for most UI design instead of a CSS framework

The project is built in the modern Next.js App Router style, and it uses client components for interactive screens and server-safe data access patterns around Supabase.

Important note: the project is a prototype, not a full production system. It is focused on workflow and usability over enterprise-grade polish.

---

## 4) Why the project is structured this way

The repo follows a simple layered architecture described in `instructions.md`:

- UI components should not talk directly to Supabase
- all database access should live in `lib/actions/`
- shared data models live in `lib/types.ts`
- Supabase is initialized in one place in `lib/supabase.ts`

This is important because it gives the app a clean separation between:

- presentation (what appears on screen)
- business logic (what counts as a valid booking or role check)
- database access (what queries run against Supabase)

That separation is useful in demos because it makes it easy to explain: “The UI is dumb; the database logic lives in actions.”

---

## 5) Folder and file map

Here is the important parts of the repo:

### Root files

- `package.json` — declares dependencies and scripts
- `README.md` — generic startup template, not very project-specific
- `instructions.md` — explains architecture rules for the app
- `.env.local` — local environment variables for Supabase credentials
- `.env.example` — template for environment values

### Main app folders

- `app/` — routes and UI screens
- `lib/` — shared logic and data access
- `public/` — static assets like logos

### App routes

- `app/page.tsx` — login entry page
- `app/volunteer/page.tsx` — volunteer dashboard and calendar
- `app/admin/page.tsx` — admin dashboard and role-gated admin portal
- `app/update-password/page.tsx` — reset password page

### Components

- `app/components/LoginForm.tsx` — sign in, sign up, reset password, Google login
- `app/admin/components/*` — admin dashboard panels
- `app/volunteer/components/*` — volunteer calendar, modals, welcome display, status bars, etc.

### Data access layer

- `lib/supabase.ts` — central Supabase client and current-user helpers
- `lib/actions/profile.ts` — role lookup
- `lib/actions/volunteer.ts` — volunteer profile creation, bookings, event fetches
- `lib/actions/admin.ts` — admin event, booking, volunteer queries and updates
- `lib/types.ts` — TypeScript types for profiles, events, bookings, volunteers

---

## 6) The database model used by the app

The app assumes Supabase tables like these exist:

### `profiles`

This holds user account metadata and role assignment.

Typical fields:

- `id` — usually the authenticated Supabase user id
- `full_name` — user’s display name
- `email` — email
- `role` — values like `admin` or `volunteer`
- `phone` — optional
- `is_present` — optional flag for attendance state

The app reads the role from this table to decide whether the user should be sent to `/admin` or `/volunteer`.

### `events`

This stores activities the nonprofit is offering.

Typical fields:

- `id`
- `title`
- `date`
- `location`
- `time_slots`
- `total_slots`
- `description` (optional)

The admin creates events with a title, date, location, time slots, and capacity.

### `bookings`

This stores a single volunteer booking for a specific event and time slot.

Typical fields:

- `id`
- `volunteer_name`
- `event_id`
- `user_id`
- `selected_slot`
- `status`
- `volunteer_email`

Status values are defined in `lib/types.ts` as:

- `Confirmed`
- `Present`
- `Completed`

The app uses booking records to:

- detect slot conflicts
- check if the user has already booked an event
- show live roster data
- mark attendance for the day

---

## 7) Authentication and user flow

### Sign-in

The main login screen is implemented in `app/components/LoginForm.tsx`.

It supports:

- email/password login
- sign up
- forgot password
- Google OAuth sign-in
- redirect logic based on role

### How login works

When a user logs in, the app does this:

1. `supabase.auth.signInWithPassword()` or OAuth login
2. fetches the user profile from the `profiles` table with the same `id`
3. reads `profile.role`
4. routes the user to:
   - `/admin` if admin
   - `/volunteer` if volunteer

### Why role-based routing matters

This prevents normal volunteers from accessing the admin dashboard. The admin page does an access guard and redirects unauthorized users away.

### Password reset

The app supports reset password via Supabase email flow, redirecting back to `/update-password`.

---

## 8) The volunteer experience

The volunteer page is the most feature-complete part of the project.

### What the volunteer sees

- a top header and status bar
- a welcome card with progress overview
- a calendar displaying available events
- click an event to open a booking modal
- choose a time slot
- sign up for an event
- view active bookings and cancel them if needed
- generate a printable progress report for completed events

### Key logic in `app/volunteer/page.tsx`

The volunteer page handles several flows:

- user authentication and redirect checks
- loading the current user and profile
- creating a missing profile automatically with `ensureUserProfile()`
- fetching event and booking data from Supabase
- subscribing to real-time booking changes via Supabase channel
- preventing duplicate sign-ups or slot conflicts
- showing toast notifications for success and error states

### Booking rules

The code includes several important guardrails:

- a volunteer cannot book the same event twice
- a selected slot cannot already be taken by another volunteer
- only the logged-in user can cancel their own booking
- unauthorized users are redirected to login or volunteer landing

This is a practical example of business logic living in the UI flow, but the actual database touches remain in `lib/actions/volunteer.ts`.

---

## 9) The admin experience

The admin page is a more operational dashboard.

### Main tabs

The admin layout contains tabs such as:

- Dashboard
- Manage Activities
- Volunteers
- Corporate CSR
- Export Reports
- Settings

Some of those tabs are placeholders and not fully implemented yet.

### Dashboard tab

The dashboard shows:

- total bookings
- active events
- registered volunteers
- system status
- live booking feed

### Manage Activities tab

This is where admins can:

- create a new event
- edit an existing event
- delete an event
- manage date, location, shift slots, and max capacity

The form includes validation and confirmation pop-ups before mutation.

### Volunteers tab

This tab lets admins:

- select an event
- view the roster for that event
- see volunteers and assigned slots
- mark attendance with a toggle between `Confirmed` and `Present`

This is the operational heart of the admin app.

---

## 10) Role and access controls

There are explicit routing and access rules:

- `app/page.tsx` appears to be the public login route
- if a logged-in user has `role === 'admin'`, they go to `/admin`
- if a logged-in user has `role === 'volunteer'`, they go to `/volunteer`
- if an admin tries to access the volunteer dashboard, the app can redirect them away
- if a non-admin user tries to access `/admin`, they get redirected

The code also checks the current session directly with Supabase before allowing dashboard access.

This is a classic simple role guard pattern: check the current user, fetch their profile role, then decide where to send them.

---

## 11) Why the code uses server-style actions and a thin UI layer

The project documentation states the architecture rule very clearly:

- UI components must never call Supabase directly
- all database logic should live in `lib/actions/`

This is good engineering practice for a small project because:

- it reduces duplicate code
- it centralizes queries in one place
- it makes it easier to debug data access bugs
- it helps the team reason about where logic belongs

Examples:

- `fetchAdminEvents()` loads events for administrators
- `fetchEventsForVolunteer()` loads the volunteer calendar data
- `createBooking()` inserts a booking
- `updateBookingAttendance()` marks someone as present
- `deleteEvent()` removes an event

This is a strong pattern to explain in a demo.

---

## 12) Real-time updates

Both the volunteer and admin dashboards subscribe to Supabase database change events.

Examples from the code:

- `supabase.channel('volunteer-bookings')`
- `supabase.channel('admin-bookings')`
- `supabase.channel('admin-events')`

The app listens for `postgres_changes` events and refreshes data when bookings or events change.

This is important because it makes the dashboard behave like a live operations board without a full state management framework.

---

## 13) The most important code files

If you need to explain the project quickly, these files matter most:

### `lib/supabase.ts`

This is the app’s backend connection layer.

It defines:

- `supabase` client
- `getCurrentUser()`
- `getCurrentUserProfile()`

These are the foundational functions that the app relies on for auth and profile loading.

### `lib/actions/volunteer.ts`

This is the volunteer domain logic.

It contains:

- event loading
- profile creation
- booking creation
- booking cancellation

This is the file most likely to be referenced in a volunteer signup demo.

### `lib/actions/admin.ts`

This is the admin domain logic.

It contains:

- list events
- list bookings
- list volunteers
- create or update events
- delete events and bookings
- attendance updates

This is the file most likely to be referenced in an admin workflow demo.

### `lib/types.ts`

This defines the shape of the app’s core domain objects.

It is the “shared vocabulary” for the project.

### `app/volunteer/page.tsx`

This is the main volunteer experience and user-centric story.

### `app/admin/page.tsx`

This is the main admin experience and operations dashboard.

### `app/components/LoginForm.tsx`

This explains the authentication entry flow and the role-based redirect story.

---

## 14) How the project handles state

The app is not using a large global state library like Redux or Zustand. Instead, it relies on:

- React `useState` for local component state
- `useEffect` to load data on page render
- Supabase real-time subscriptions to refresh on changes

This is a good choice for a small prototype because it keeps the app easier to understand and easier to debug.

Typical examples:

- `events`, `bookings`, `volunteers` in admin page state
- `selectedEvent`, `selectedTimeSlot`, `isSubmitting` in volunteer page state
- modals and toast tracking are all local

---

## 15) Data flow, simplified

Here is the conceptual data flow:

1. Supabase auth stores the user account
2. the app fetches the user’s record from `profiles`
3. the role determines the route
4. the page loads events and bookings from Supabase
5. the user interacts with the UI
6. an action function writes changes to the database
7. a Supabase change event triggers the dashboard to refresh

That is the basic lifecycle of the app.

---

## 16) Important behavior differences to know before a demo

There are a few project-specific things that are easy to miss if you are new:

### 1. `README.md` is generic

The repo root README is the default Next.js starter README. It is not customized to this project. If you are preparing a demo, do not rely on it for project facts.

### 2. The app is a prototype, not a finished production product

There are placeholder admin tabs like “Corporate CSR,” “Export Reports,” and “Settings.” They exist but are not implemented.

### 3. Most styling is inline

This app uses direct CSS-in-JS style objects instead of a component library or Tailwind theme. That is fine for a small app, but it is important to know if you are trying to explain the design system.

### 4. There is no heavy test suite visible

The codebase appears focused on feature-building and workflow rather than extensive automated testing.

### 5. Supabase environment variables are required

The app will fail without:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

This is critical for setup.

---

## 17) How to run the app locally

From the project root (`ladles-prototype`):

```bash
npm install
npm run dev
```

Then open the browser at:

```text
http://localhost:3000
```

You will need valid Supabase environment variables in a local `.env.local` file.

### Expected environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app will throw an error at startup if these are not present.

---

## 18) Demo prep checklist

If you want a polished demo, here is the best path:

### Setup

- confirm Supabase project is running
- confirm `.env.local` has the required variables
- start the app with `npm run dev`
- confirm user roles exist in `profiles`
- ensure at least one admin user and one volunteer user exist

### Demo flow 1: volunteer signup

1. sign in as a volunteer account
2. navigate to the volunteer dashboard
3. show the calendar and event list
4. click an event
5. choose a time slot
6. confirm sign-up
7. show the booking appear in the active list
8. explain the slot conflict logic and duplicate booking prevention

### Demo flow 2: admin management

1. sign in as admin user
2. open the admin dashboard
3. show metrics and live booking feed
4. go to “Manage Activities”
5. create an event with a date, slot list, and capacity
6. show the event in the list
7. open the “Volunteers” tab
8. select the event and show the roster
9. mark a volunteer present
10. explain real-time updates and role-based access

### Demo flow 3: password reset / profile flow

1. show sign-up page
2. create a user account
3. note that the profile is created or linked automatically
4. demonstrate password reset flow via email link
5. explain redirect after login based on role

---

## 19) What decisions were made and why

Here are the project decisions that matter most:

### Decision: role-based routing

Why: the app has two distinct user experiences. Route guard logic is cheaper and easier to reason about than a single mega-layout.

### Decision: thin UI, database functions in `lib/actions/`

Why: it keeps logic organized, prevents duplicate database calls, and makes the app easier to maintain.

### Decision: direct Supabase client in a central file

Why: one connection point means fewer mistakes when changing environment variables or connection logic.

### Decision: no large global state manager

Why: for a small app, `useState` and Supabase subscriptions are enough and simpler to debug.

### Decision: real-time updates

Why: the dashboard should feel live and operational, especially for tracking sign-ups and attendance.

### Decision: inline styling

Why: it keeps the prototype fast and simple, without the overhead of introducing a design system or CSS framework.

### Decision: prototype-first scope

Why: there are panels that are intentionally unfinished, which signals the product is still being developed rather than finalizing all modules.

---

## 20) Risks, limitations, and areas to watch

This is the honest reality of the current codebase:

- the app depends heavily on Supabase being configured correctly
- database schema assumptions are a real requirement
- there is no strong visible production security layer beyond simple role checks and RLS assumptions in the database
- the app feels like a prototype, not a fully mature operations product
- the generic README is stale and does not reflect this application
- some UI logic and business rules are mixed into page components rather than fully separated into domain services

This is not a criticism; it is simply the nature of a small, practical prototype.

---

## 21) The simple version to say in one minute

If you need a 60-second explanation, say this:

“This project is a volunteer management app for Ladles of Love. It uses Next.js and Supabase to let volunteers sign up for events, admins create activities, and staff track attendance. The app routes users by role, fetches data with centralized action functions, and refreshes in real time as bookings change.”

That is the core story.

---

## 22) Final note for demos and handoff

For a demo, the highest-value story is:

- users log in
- volunteers sign up for events
- admins manage the schedule and attendance
- the data updates live
- the app enforces role-based restrictions and slot rules

That tells the entire story of the product in a way that is easy for a non-technical audience to understand.

This repo is not just “a website”; it is a role-based volunteer scheduling workflow built around a nonprofit operations use case.

---

## 23) Quick reference summary

If you need the shortest possible cheat sheet:

- App type: volunteer scheduling and admin operations dashboard
- Framework: Next.js + React + TypeScript
- Backend: Supabase
- Main flows: login, sign-up, role routing, event booking, admin event management, attendance tracking
- Core tables: `profiles`, `events`, `bookings`
- Main directories: `app/`, `lib/`, `public/`
- Architecture rule: keep Supabase logic in `lib/actions/`, not in presentation components
- Best demo story: volunteer signs up; admin sees the event and marks attendance live

---

This document should serve as a durable overview for the project. If you are preparing for a demo, use it as your reference before you explain the app to a new stakeholder, teammate, or reviewer.
