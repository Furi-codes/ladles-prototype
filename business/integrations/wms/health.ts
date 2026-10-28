/**
 * Provides the WMS integration health/configuration check.
 * The shared WMS authentication check protects this endpoint too.
 */

import { requireWmsAuthentication } from "@/data/server/wms-integration";



/** Confirms the endpoint accepts the WMS token, not that booking/attendance RPCs are installed. */
export async function GET(request: Request) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;

  return Response.json({ status: "ok" });
}
