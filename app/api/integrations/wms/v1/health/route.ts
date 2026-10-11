/** Authenticated integration health response; it does not query the database. */
import { requireWmsAuthentication } from "@/lib/server/wms-integration";

export const runtime = "nodejs";

/** Confirms the endpoint accepts the WMS token, not that booking/attendance RPCs are installed. */
export async function GET(request: Request) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;

  return Response.json({ status: "ok" });
}
