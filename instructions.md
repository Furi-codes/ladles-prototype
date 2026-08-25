# Layered Server-First Architecture

This project follows a layered architecture to keep the UI thin, the data access predictable, and the app easier to maintain.

Rules:
- UI components must never call Supabase directly. All database logic lives in lib/actions/.
- Favor Server Components where possible.
- Keep business rules and data fetch logic out of presentation files.
- Reuse small, focused components instead of large monolithic screens.
- Centralize shared domain types in lib/types.ts.

The architecture pattern is:
1. Server Components render the page shell and pass typed props.
2. Client Components handle interactivity only.
3. Data access lives in lib/actions/ and is the only layer that touches Supabase.
4. Shared domain models live in lib/types.ts.

UI components must never call Supabase directly. All database logic lives in lib/actions/. Favor Server Components where possible.
