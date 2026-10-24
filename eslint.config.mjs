/** Lint rules used by npm run lint: Next.js web-vitals/TypeScript checks, excluding build output. */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Local generated browser-review bundles and captures, not application source.
    ".exports/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
