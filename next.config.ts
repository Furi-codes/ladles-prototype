/**
 * Holds the Next.js build/runtime options for this project.
 * Keep runtime defaults, with extra generated repository instructions disabled.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Starting the development server should not create extra instruction documents.
  agentRules: false,
};

export default nextConfig;
