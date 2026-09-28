import { requireWmsAuthentication } from "@/lib/server/wms-integration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authenticationError = requireWmsAuthentication(request);
  if (authenticationError) return authenticationError;

  return Response.json({ status: "ok" });
}
