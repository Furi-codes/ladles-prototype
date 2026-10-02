# UI polish from the reference videos

Reviewed sampled frames of the supplied AMPLIFY and Ciovita MP4s, not copied assets or layouts. Review contact sheets are local only in `.demo-assets/` (ignored by Git). Frame sampling establishes layout patterns; it does not verify every interaction or animation in the videos.

## Implemented in this pass

- Admin and volunteer top bars remain sticky at the top while the document scrolls. Existing sidebar/drawer/dialog stacking stays unchanged.
- Login, account creation and password recovery share a new responsive CSS-module design, using the existing authentication actions and role routing.
- Ciovita's brand-panel/form separation inspired a Ladles-specific welcome panel. Original code-native bowl/heart illustration replaces stock photography; no images or text were taken from the references.
- Amplify's strong brand identity and compact mobile presentation informed the welcome message, red accents and reduced mobile hero.
- Clear Sign in/Create account buttons, associated labels, autofill hints, focus rings, password visibility, native keyboard buttons, disabled form controls while submitting and visible status messages.
- Light/dark colours and restrained entry/hover transitions with reduced-motion support. These transitions are our own design, not claimed to reproduce video animations.
- Temporary video decoder removed after extraction; original videos unchanged. No new app dependency, Supabase migration or authentication provider configuration.

## Suggested next changes — not implemented yet

Latest follow-up (2 October 2026): removed the stock-photo panel, caption and credit from the login/sign-up page at the user's request. The form is now centred, retains the Ladles logo, and no longer mentions administrators. The unused stock asset/license reference is retained locally pending a user-supplied replacement; it is not rendered or requested by the page.

1. **Actionable dashboard summaries:** replace the decorative “Dashboard data: Loaded” card with something operational, such as shifts needing attendance review. Define the exact count first; never substitute made-up data.
2. **Guided booking details:** show a small Booked → Clocked in → Completed sequence with the real booking status. Inspired by Ciovita's step-by-step return workflow; keep booking itself short rather than add unnecessary steps.
3. **Chart drill-down:** select a month/programme in a graph to inspect matching events. Inspired by Amplify's summary-to-detail analytics; reuse existing report filters so charts, tables and exports stay in sync.
4. **Consistent detail drawers:** event details, roster actions and company details should use the same header/action layout, with primary actions anchored and errors next to the relevant field.
5. **Purposeful feedback:** consistent skeleton loading, save confirmations, empty states and restrained transitions. Avoid animated counters that imply precision or AI insights that are not backed by data.
6. **Authentic imagery:** if Ladles supplies an approved volunteering photograph, it can replace the illustration in the desktop welcome panel. Do not reuse Ciovita's product photograph.

## Verification boundary

Local lint, TypeScript, regression tests and production build are the technical checks. No connected browser was exposed for this pass, so actual sticky scrolling, mobile keyboard/layout, sign-in/sign-up/recovery interaction and appearance still require browser review. Do not claim visual or live-auth end-to-end completion from a successful build.
