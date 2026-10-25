/**
 * Loads the Tailwind PostCSS plugin during CSS processing.
 * This is a build-time stylesheet step, not code that runs when a user submits a form.
 */

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
